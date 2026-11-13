from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import and_, or_

from app.extensions import db
from app.modules.doos.models import Doo, DooSubtask
from app.modules.wishes.models import Wish
from app.modules.workspaces.models import Category, Workspace, WorkspaceMember


class DoosError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def resolve_user_workspace(user_id: str, requested_workspace_id: Optional[str] = None) -> Workspace:
    if requested_workspace_id:
        membership = (
            db.session.query(WorkspaceMember)
            .filter_by(workspace_id=requested_workspace_id, user_id=user_id)
            .first()
        )
        if not membership:
            raise DoosError("forbidden_workspace", "You do not have access to this workspace.", 403)
        ws = db.session.get(Workspace, requested_workspace_id)
        if not ws:
            raise DoosError("workspace_not_found", "Requested workspace was not found.", 404)
        return ws

    membership = (
        db.session.query(WorkspaceMember)
        .filter_by(user_id=user_id)
        .order_by(WorkspaceMember.joined_at.asc())
        .first()
    )
    if not membership:
        raise DoosError("no_workspace", "No active workspace found for this user.", 404)
    ws = db.session.get(Workspace, membership.workspace_id)
    if not ws:
        raise DoosError("workspace_not_found", "Default workspace was not found.", 404)
    return ws


def _serialize_doo(doo: Doo) -> Dict[str, Any]:
    subtasks = [
        {
            "id": s.id,
            "title": s.title,
            "is_completed": s.is_completed,
            "sort_order": s.sort_order,
        }
        for s in doo.subtasks
    ]
    total_subtasks = len(subtasks)
    done_subtasks = sum(1 for s in subtasks if s["is_completed"])
    progress_percent = int((done_subtasks / total_subtasks) * 100) if total_subtasks > 0 else (100 if doo.status == "done" else 0)

    wish_data = None
    if doo.wish_id:
        wish = db.session.get(Wish, doo.wish_id)
        if wish:
            wish_data = {
                "id": wish.id,
                "title": wish.title,
                "status": wish.status,
                "estimated_price": wish.estimated_price,
            }

    category_name = None
    if doo.category_id:
        cat = db.session.get(Category, doo.category_id)
        if cat:
            category_name = cat.name

    return {
        "id": doo.id,
        "workspace_id": doo.workspace_id,
        "wish_id": doo.wish_id,
        "wish": wish_data,
        "category_id": doo.category_id,
        "category_name": category_name,
        "assigned_to": doo.assigned_to,
        "title": doo.title,
        "notes": doo.notes,
        "priority": doo.priority,
        "status": doo.status,
        "due_date": doo.due_date.isoformat() if doo.due_date else None,
        "recurrence_rule": doo.recurrence_rule,
        "completed_at": doo.completed_at.isoformat() if doo.completed_at else None,
        "created_at": doo.created_at.isoformat() if doo.created_at else None,
        "subtasks": subtasks,
        "total_subtasks": total_subtasks,
        "done_subtasks": done_subtasks,
        "progress_percent": progress_percent,
    }


def list_doos(
    user_id: str,
    workspace_id: Optional[str] = None,
    view: str = "all",  # today | upcoming | all | completed | calendar
    priority: Optional[str] = None,
    status: Optional[str] = None,
    category_id: Optional[str] = None,
    wish_id: Optional[str] = None,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    ws = resolve_user_workspace(user_id, workspace_id)
    today = date.today()

    query = db.session.query(Doo).filter(Doo.workspace_id == ws.id)

    if wish_id:
        query = query.filter(Doo.wish_id == wish_id)

    if category_id:
        query = query.filter(Doo.category_id == category_id)

    if priority and priority != "all":
        query = query.filter(Doo.priority == priority)

    if status and status != "all":
        query = query.filter(Doo.status == status)

    if search:
        query = query.filter(Doo.title.ilike(f"%{search.strip()}%"))

    # Apply view pill filtering
    if view == "today":
        # Tasks due today or overdue, not done
        query = query.filter(
            and_(
                Doo.due_date.isnot(None),
                Doo.due_date <= today,
                Doo.status != "done",
            )
        )
    elif view == "upcoming":
        # Tasks due after today, not done
        query = query.filter(
            and_(
                Doo.due_date.isnot(None),
                Doo.due_date > today,
                Doo.status != "done",
            )
        )
    elif view == "completed":
        query = query.filter(Doo.status == "done")

    # Order by status (todo/in_progress first, then done), then due_date, then created_at desc
    all_doos_in_ws = db.session.query(Doo).filter(Doo.workspace_id == ws.id).all()
    
    # Calculate summary metrics
    total_doos = len(all_doos_in_ws)
    today_doos = sum(1 for d in all_doos_in_ws if d.due_date and d.due_date <= today and d.status != "done")
    upcoming_doos = sum(1 for d in all_doos_in_ws if d.due_date and d.due_date > today and d.status != "done")
    completed_doos = sum(1 for d in all_doos_in_ws if d.status == "done")
    pending_doos = sum(1 for d in all_doos_in_ws if d.status in ("todo", "in_progress"))

    items = query.order_by(
        Doo.status.asc(),
        Doo.due_date.asc().nulls_last(),
        Doo.created_at.desc(),
    ).all()

    return {
        "workspace": {
            "id": ws.id,
            "name": ws.name,
            "currency": ws.currency,
        },
        "summary": {
            "total_doos": total_doos,
            "pending_doos": pending_doos,
            "today_doos": today_doos,
            "upcoming_doos": upcoming_doos,
            "completed_doos": completed_doos,
        },
        "items": [_serialize_doo(d) for d in items],
    }


def get_doo_detail(user_id: str, doo_id: str) -> Dict[str, Any]:
    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DoosError("doo_not_found", "Task not found.", 404)
    resolve_user_workspace(user_id, doo.workspace_id)
    return _serialize_doo(doo)


def create_doo(user_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    ws = resolve_user_workspace(user_id, payload.get("workspace_id"))
    
    parsed_due_date = None
    if payload.get("due_date"):
        try:
            parsed_due_date = date.fromisoformat(payload["due_date"])
        except ValueError:
            raise DoosError("invalid_date", "due_date must be in YYYY-MM-DD format.", 422)

    # Optional wish linking validation
    wish_id = payload.get("wish_id")
    if wish_id:
        wish = db.session.get(Wish, wish_id)
        if not wish or wish.workspace_id != ws.id:
            raise DoosError("invalid_wish", "Linked Wish not found in workspace.", 404)

    # Optional category validation
    cat_id = payload.get("category_id")
    if cat_id:
        cat = db.session.get(Category, cat_id)
        if not cat or cat.workspace_id != ws.id:
            raise DoosError("invalid_category", "Selected category not found.", 404)

    doo = Doo(
        workspace_id=ws.id,
        wish_id=wish_id,
        category_id=cat_id,
        assigned_to=payload.get("assigned_to"),
        title=payload["title"].strip(),
        notes=payload.get("notes"),
        priority=payload.get("priority", "medium"),
        status=payload.get("status", "todo"),
        due_date=parsed_due_date,
        recurrence_rule=payload.get("recurrence_rule", "none"),
        completed_at=datetime.now(timezone.utc) if payload.get("status") == "done" else None,
    )
    db.session.add(doo)
    db.session.flush()

    subtasks_data = payload.get("subtasks") or []
    for i, sub in enumerate(subtasks_data):
        st = DooSubtask(
            doo_id=doo.id,
            title=sub["title"].strip(),
            is_completed=bool(sub.get("is_completed", False)),
            sort_order=sub.get("sort_order", i),
        )
        db.session.add(st)

    db.session.commit()
    return _serialize_doo(doo)


def update_doo(user_id: str, doo_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DoosError("doo_not_found", "Task not found.", 404)
    resolve_user_workspace(user_id, doo.workspace_id)

    if "title" in payload and payload["title"] is not None:
        doo.title = payload["title"].strip()

    if "notes" in payload:
        doo.notes = payload["notes"]

    if "priority" in payload and payload["priority"] is not None:
        doo.priority = payload["priority"]

    if "recurrence_rule" in payload and payload["recurrence_rule"] is not None:
        doo.recurrence_rule = payload["recurrence_rule"]

    if "wish_id" in payload:
        w_id = payload["wish_id"]
        if w_id:
            wish = db.session.get(Wish, w_id)
            if not wish or wish.workspace_id != doo.workspace_id:
                raise DoosError("invalid_wish", "Linked Wish not found in workspace.", 404)
            doo.wish_id = w_id
        else:
            doo.wish_id = None

    if "category_id" in payload:
        c_id = payload["category_id"]
        if c_id:
            cat = db.session.get(Category, c_id)
            if not cat or cat.workspace_id != doo.workspace_id:
                raise DoosError("invalid_category", "Selected category not found.", 404)
            doo.category_id = c_id
        else:
            doo.category_id = None

    if "due_date" in payload:
        if payload["due_date"]:
            try:
                doo.due_date = date.fromisoformat(payload["due_date"])
            except ValueError:
                raise DoosError("invalid_date", "due_date must be in YYYY-MM-DD format.", 422)
        else:
            doo.due_date = None

    if "status" in payload and payload["status"] is not None:
        new_status = payload["status"]
        old_status = doo.status
        doo.status = new_status
        if new_status == "done" and old_status != "done":
            doo.completed_at = datetime.now(timezone.utc)
        elif new_status != "done":
            doo.completed_at = None

    if "subtasks" in payload and payload["subtasks"] is not None:
        # Replace subtasks list
        for old_sub in doo.subtasks:
            db.session.delete(old_sub)
        db.session.flush()

        for i, sub in enumerate(payload["subtasks"]):
            st = DooSubtask(
                doo_id=doo.id,
                title=sub["title"].strip(),
                is_completed=bool(sub.get("is_completed", False)),
                sort_order=sub.get("sort_order", i),
            )
            db.session.add(st)

    db.session.commit()
    return _serialize_doo(doo)


def toggle_doo_status(user_id: str, doo_id: str, target_status: Optional[str] = None) -> Dict[str, Any]:
    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DoosError("doo_not_found", "Task not found.", 404)
    resolve_user_workspace(user_id, doo.workspace_id)

    if target_status:
        doo.status = target_status
    else:
        doo.status = "done" if doo.status != "done" else "todo"

    if doo.status == "done":
        doo.completed_at = datetime.now(timezone.utc)
        # If task has recurrence, advance due_date or spawn recurring instance
        if doo.recurrence_rule and doo.recurrence_rule != "none" and doo.due_date:
            if doo.recurrence_rule == "daily":
                doo.due_date = doo.due_date + timedelta(days=1)
                doo.status = "todo"
                doo.completed_at = None
            elif doo.recurrence_rule == "weekly":
                doo.due_date = doo.due_date + timedelta(weeks=1)
                doo.status = "todo"
                doo.completed_at = None
            elif doo.recurrence_rule == "monthly":
                # Advance 30 days
                doo.due_date = doo.due_date + timedelta(days=30)
                doo.status = "todo"
                doo.completed_at = None
    else:
        doo.completed_at = None

    db.session.commit()
    return _serialize_doo(doo)


def delete_doo(user_id: str, doo_id: str) -> None:
    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DoosError("doo_not_found", "Task not found.", 404)
    resolve_user_workspace(user_id, doo.workspace_id)
    db.session.delete(doo)
    db.session.commit()


def add_subtask(user_id: str, doo_id: str, title: str, sort_order: int = 0) -> Dict[str, Any]:
    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DoosError("doo_not_found", "Task not found.", 404)
    resolve_user_workspace(user_id, doo.workspace_id)

    st = DooSubtask(
        doo_id=doo.id,
        title=title.strip(),
        is_completed=False,
        sort_order=sort_order,
    )
    db.session.add(st)
    db.session.commit()
    return _serialize_doo(doo)


def toggle_subtask(user_id: str, doo_id: str, subtask_id: str, is_completed: Optional[bool] = None) -> Dict[str, Any]:
    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DoosError("doo_not_found", "Task not found.", 404)
    resolve_user_workspace(user_id, doo.workspace_id)

    subtask = db.session.get(DooSubtask, subtask_id)
    if not subtask or subtask.doo_id != doo.id:
        raise DoosError("subtask_not_found", "Subtask not found.", 404)

    if is_completed is not None:
        subtask.is_completed = is_completed
    else:
        subtask.is_completed = not subtask.is_completed

    db.session.commit()
    return _serialize_doo(doo)


def delete_subtask(user_id: str, doo_id: str, subtask_id: str) -> Dict[str, Any]:
    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DoosError("doo_not_found", "Task not found.", 404)
    resolve_user_workspace(user_id, doo.workspace_id)

    subtask = db.session.get(DooSubtask, subtask_id)
    if not subtask or subtask.doo_id != doo.id:
        raise DoosError("subtask_not_found", "Subtask not found.", 404)

    db.session.delete(subtask)
    db.session.commit()
    return _serialize_doo(doo)
