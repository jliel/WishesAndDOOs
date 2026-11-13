from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.modules.auth.models import AuditLog, User
from app.modules.doos.models import Doo
from app.modules.finances.models import Account, SavingsGoal, Transaction
from app.modules.wishes.models import Wish
from app.modules.wishes.schemas import WishCreateRequest, WishFulfillRequest, WishUpdateRequest
from app.modules.workspaces.models import Category, Workspace, WorkspaceMember


class WishesError(Exception):
    def __init__(self, message: str, code: str = "wishes_error", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def record_audit_event(
    user_id: Optional[str],
    workspace_id: Optional[str],
    event_type: str,
    metadata_json: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
):
    try:
        log = AuditLog(
            user_id=user_id,
            workspace_id=workspace_id,
            event_type=event_type,
            metadata_json=metadata_json or {},
            ip_address=ip_address,
        )
        db.session.add(log)
    except Exception:
        pass


def resolve_user_workspace(user: User, workspace_id: Optional[str] = None) -> Workspace:
    if workspace_id:
        membership = db.session.execute(
            select(WorkspaceMember).where(
                WorkspaceMember.user_id == user.id,
                WorkspaceMember.workspace_id == workspace_id,
            )
        ).scalar_one_or_none()
        if not membership:
            raise WishesError("Workspace not found or unauthorized.", "workspace_unauthorized", 403)
        ws = db.session.get(Workspace, workspace_id)
        if not ws:
            raise WishesError("Workspace not found.", "workspace_not_found", 404)
        return ws

    memberships = (
        db.session.execute(
            select(WorkspaceMember)
            .where(WorkspaceMember.user_id == user.id)
            .order_by(WorkspaceMember.joined_at.asc())
        )
        .scalars()
        .all()
    )
    if not memberships:
        raise WishesError("User does not belong to any workspace.", "no_workspace", 404)

    ws = db.session.get(Workspace, memberships[0].workspace_id)
    if not ws:
        raise WishesError("Default workspace not found.", "workspace_not_found", 404)
    return ws


def serialize_wish(wish: Wish, server_origin: str = "") -> Dict[str, Any]:
    # Link Savings Goal info if present
    savings_goal = None
    if wish.savings_goal_id:
        sg = db.session.get(SavingsGoal, wish.savings_goal_id)
        if sg:
            target = float(sg.target_amount) if sg.target_amount else 0.0
            current = float(sg.current_amount) if sg.current_amount else 0.0
            pct = min(100.0, round((current / target * 100), 1)) if target > 0 else 0.0
            savings_goal = {
                "id": sg.id,
                "name": sg.name,
                "target_amount": target,
                "current_amount": current,
                "progress_percent": pct,
                "color": sg.color or "#10B981",
                "icon": sg.icon or "savings",
            }

    # Linked Account info if present
    account_info = None
    if getattr(wish, "account_id", None):
        acc = db.session.get(Account, wish.account_id)
        if acc:
            account_info = {
                "id": acc.id,
                "name": acc.name,
                "type": acc.type,
                "balance": float(acc.balance),
                "icon": acc.icon,
                "color": acc.color,
            }

    # Category info if present
    category_name = None
    category_icon = "auto-awesome"
    category_color = "#7C3AED"
    if wish.category_id:
        cat = db.session.get(Category, wish.category_id)
        if cat:
            category_name = cat.name
            category_icon = cat.icon or category_icon
            category_color = cat.color or category_color

    # Count linked DOOs
    linked_doos = db.session.execute(
        select(Doo).where(Doo.wish_id == wish.id)
    ).scalars().all()
    total_doos = len(linked_doos)
    done_doos = sum(1 for d in linked_doos if d.status == "done")
    doo_progress_pct = round((done_doos / total_doos * 100), 1) if total_doos > 0 else 0.0

    # Image URL if storage key exists
    image_url = None
    if wish.image_storage_key:
        image_url = f"/api/v1/wishes/images/{wish.image_storage_key.replace('wishes/', '')}"

    return {
        "id": wish.id,
        "workspace_id": wish.workspace_id,
        "category_id": wish.category_id,
        "category_name": category_name,
        "category_icon": category_icon,
        "category_color": category_color,
        "savings_goal_id": wish.savings_goal_id,
        "savings_goal": savings_goal,
        "account_id": getattr(wish, "account_id", None),
        "account": account_info,
        "title": wish.title,
        "notes": wish.notes,
        "url": wish.url,
        "image_storage_key": wish.image_storage_key,
        "image_url": image_url,
        "estimated_price": float(wish.estimated_price) if wish.estimated_price is not None else None,
        "priority": wish.priority,
        "status": wish.status,
        "granted_at": wish.granted_at.isoformat() if wish.granted_at else None,
        "fulfilled_transaction_id": wish.fulfilled_transaction_id,
        "linked_doos_count": total_doos,
        "linked_doos_done": done_doos,
        "doo_progress_percent": doo_progress_pct,
        "created_at": wish.created_at.isoformat() if wish.created_at else None,
    }


def list_wishes(
    user: User,
    workspace_id: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category_id: Optional[str] = None,
) -> Dict[str, Any]:
    ws = resolve_user_workspace(user, workspace_id)
    query = select(Wish).where(Wish.workspace_id == ws.id)

    if status and status != "all":
        query = query.where(Wish.status == status)
    if priority and priority != "all":
        query = query.where(Wish.priority == priority)
    if category_id and category_id != "all":
        query = query.where(Wish.category_id == category_id)

    query = query.order_by(
        Wish.status.asc(),
        Wish.created_at.desc(),
    )

    wishes = db.session.execute(query).scalars().all()
    serialized = [serialize_wish(w) for w in wishes]

    # Calculate summary metrics for header
    total_wishes = len(serialized)
    active_wishes = sum(1 for w in serialized if w["status"] == "active")
    granted_wishes = sum(1 for w in serialized if w["status"] == "granted")
    total_estimated_value = sum(w["estimated_price"] or 0.0 for w in serialized if w["status"] == "active")

    return {
        "workspace": {
            "id": ws.id,
            "name": ws.name,
            "currency": ws.currency,
        },
        "summary": {
            "total_wishes": total_wishes,
            "active_wishes": active_wishes,
            "granted_wishes": granted_wishes,
            "total_estimated_value": round(total_estimated_value, 2),
        },
        "wishes": serialized,
    }


def create_wish(
    user: User,
    payload: WishCreateRequest,
    workspace_id: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    ws = resolve_user_workspace(user, workspace_id or payload.workspace_id)

    # Validate category belongs to workspace if provided
    if payload.category_id:
        cat = db.session.get(Category, payload.category_id)
        if not cat or cat.workspace_id != ws.id:
            raise WishesError("Category not found in workspace.", "category_not_found", 404)

    # Validate savings goal belongs to workspace if provided
    if payload.savings_goal_id:
        sg = db.session.get(SavingsGoal, payload.savings_goal_id)
        if not sg or sg.workspace_id != ws.id:
            raise WishesError("Savings goal not found in workspace.", "savings_goal_not_found", 404)

    # Validate account belongs to workspace if provided
    if payload.account_id:
        acc = db.session.get(Account, payload.account_id)
        if not acc or acc.workspace_id != ws.id:
            raise WishesError("Account not found in workspace.", "account_not_found", 404)

    wish = Wish(
        workspace_id=ws.id,
        category_id=payload.category_id or None,
        savings_goal_id=payload.savings_goal_id or None,
        account_id=payload.account_id or None,
        title=payload.title.strip(),
        notes=payload.notes.strip() if payload.notes else None,
        url=payload.url.strip() if payload.url else None,
        image_storage_key=payload.image_storage_key,
        estimated_price=Decimal(str(payload.estimated_price)) if payload.estimated_price is not None else None,
        priority=payload.priority,
        status="active",
    )
    db.session.add(wish)
    db.session.flush()

    # Link any chosen DOO tasks to this wish
    if payload.linked_doo_ids:
        for doo_id in payload.linked_doo_ids:
            doo_task = db.session.get(Doo, doo_id)
            if doo_task and doo_task.workspace_id == ws.id:
                doo_task.wish_id = wish.id

    db.session.commit()

    record_audit_event(
        user_id=user.id,
        workspace_id=ws.id,
        event_type="wish_created",
        metadata_json={"wish_id": wish.id, "title": wish.title, "priority": wish.priority},
        ip_address=ip_address,
    )
    return serialize_wish(wish)


def update_wish(
    user: User,
    wish_id: str,
    payload: WishUpdateRequest,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    wish = db.session.get(Wish, wish_id)
    if not wish:
        raise WishesError("Wish not found.", "wish_not_found", 404)

    # Verify authorization
    resolve_user_workspace(user, wish.workspace_id)

    if payload.title is not None:
        wish.title = payload.title.strip()
    if payload.category_id is not None:
        if payload.category_id == "" or payload.category_id == "none":
            wish.category_id = None
        else:
            cat = db.session.get(Category, payload.category_id)
            if not cat or cat.workspace_id != wish.workspace_id:
                raise WishesError("Category not found in workspace.", "category_not_found", 404)
            wish.category_id = cat.id
    if payload.savings_goal_id is not None:
        if payload.savings_goal_id == "" or payload.savings_goal_id == "none":
            wish.savings_goal_id = None
        else:
            sg = db.session.get(SavingsGoal, payload.savings_goal_id)
            if not sg or sg.workspace_id != wish.workspace_id:
                raise WishesError("Savings goal not found in workspace.", "savings_goal_not_found", 404)
            wish.savings_goal_id = sg.id
    if payload.account_id is not None:
        if payload.account_id == "" or payload.account_id == "none":
            wish.account_id = None
        else:
            acc = db.session.get(Account, payload.account_id)
            if not acc or acc.workspace_id != wish.workspace_id:
                raise WishesError("Account not found in workspace.", "account_not_found", 404)
            wish.account_id = acc.id
    if payload.notes is not None:
        wish.notes = payload.notes.strip() if payload.notes else None
    if payload.url is not None:
        wish.url = payload.url.strip() if payload.url else None
    if payload.image_storage_key is not None:
        wish.image_storage_key = payload.image_storage_key or None
    if payload.estimated_price is not None:
        wish.estimated_price = Decimal(str(payload.estimated_price)) if payload.estimated_price is not None else None
    if payload.priority is not None:
        wish.priority = payload.priority
    if payload.status is not None:
        wish.status = payload.status
        if payload.status == "granted" and not wish.granted_at:
            wish.granted_at = datetime.now(timezone.utc)
        elif payload.status != "granted":
            wish.granted_at = None

    # Update linked DOO tasks if explicitly provided
    if payload.linked_doo_ids is not None:
        # Unlink existing DOOs not in the list
        existing_doos = db.session.execute(
            select(Doo).where(Doo.wish_id == wish.id)
        ).scalars().all()
        for d in existing_doos:
            if d.id not in payload.linked_doo_ids:
                d.wish_id = None

        # Link new DOOs in list
        for doo_id in payload.linked_doo_ids:
            doo_task = db.session.get(Doo, doo_id)
            if doo_task and doo_task.workspace_id == wish.workspace_id:
                doo_task.wish_id = wish.id

    db.session.commit()
    record_audit_event(
        user_id=user.id,
        workspace_id=wish.workspace_id,
        event_type="wish_updated",
        metadata_json={"wish_id": wish.id, "title": wish.title, "status": wish.status},
        ip_address=ip_address,
    )
    return serialize_wish(wish)


def delete_wish(
    user: User,
    wish_id: str,
    ip_address: Optional[str] = None,
) -> None:
    wish = db.session.get(Wish, wish_id)
    if not wish:
        raise WishesError("Wish not found.", "wish_not_found", 404)

    resolve_user_workspace(user, wish.workspace_id)

    # Detach linked DOOs
    db.session.execute(
        select(Doo).where(Doo.wish_id == wish.id)
    )
    linked_doos = db.session.execute(select(Doo).where(Doo.wish_id == wish.id)).scalars().all()
    for d in linked_doos:
        d.wish_id = None

    db.session.delete(wish)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        workspace_id=wish.workspace_id,
        event_type="wish_deleted",
        metadata_json={"wish_id": wish_id, "title": wish.title},
        ip_address=ip_address,
    )


def get_wish_detail(user: User, wish_id: str) -> Dict[str, Any]:
    wish = db.session.get(Wish, wish_id)
    if not wish:
        raise WishesError("Wish not found.", "wish_not_found", 404)

    ws = resolve_user_workspace(user, wish.workspace_id)
    base = serialize_wish(wish)

    # Detailed linked DOOs
    linked_doos = db.session.execute(
        select(Doo).where(Doo.wish_id == wish.id).order_by(Doo.created_at.asc())
    ).scalars().all()

    detailed_doos = []
    for d in linked_doos:
        subtasks_list = [
            {
                "id": st.id,
                "title": st.title,
                "is_completed": st.is_completed,
                "sort_order": st.sort_order,
            }
            for st in d.subtasks
        ]
        detailed_doos.append({
            "id": d.id,
            "title": d.title,
            "notes": d.notes,
            "priority": d.priority,
            "status": d.status,
            "due_date": d.due_date.isoformat() if d.due_date else None,
            "recurrence_rule": d.recurrence_rule,
            "subtasks_count": len(subtasks_list),
            "subtasks_completed": sum(1 for st in subtasks_list if st["is_completed"]),
            "subtasks": subtasks_list,
        })

    # Detailed fulfilled transaction info
    fulfilled_tx = None
    if wish.fulfilled_transaction_id:
        tx = db.session.get(Transaction, wish.fulfilled_transaction_id)
        if tx:
            acc = db.session.get(Account, tx.account_id)
            fulfilled_tx = {
                "id": tx.id,
                "account_id": tx.account_id,
                "account_name": acc.name if acc else "Unknown Account",
                "amount": float(tx.amount),
                "description": tx.description,
                "transaction_date": tx.transaction_date.isoformat() if tx.transaction_date else None,
            }

    base["workspace"] = {
        "id": ws.id,
        "name": ws.name,
        "currency": ws.currency,
    }
    base["linked_doos"] = detailed_doos
    base["fulfilled_transaction"] = fulfilled_tx
    return base


def fulfill_wish(
    user: User,
    wish_id: str,
    payload: WishFulfillRequest,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    wish = db.session.get(Wish, wish_id)
    if not wish:
        raise WishesError("Wish not found.", "wish_not_found", 404)

    ws = resolve_user_workspace(user, wish.workspace_id)

    # If already granted, verify or update
    if payload.record_expense and not wish.fulfilled_transaction_id:
        # If payload.account_id not passed, fallback to wish.account_id
        chosen_acc_id = payload.account_id or getattr(wish, "account_id", None)
        if not chosen_acc_id:
            raise WishesError("Please select an account to pay from.", "account_required", 400)
        account = db.session.get(Account, chosen_acc_id)
        if not account or account.workspace_id != ws.id:
            raise WishesError("Funding account not found in workspace.", "account_not_found", 404)

        amount_val = payload.expense_amount if payload.expense_amount is not None else float(wish.estimated_price or 0.0)
        if amount_val <= 0:
            raise WishesError("Expense amount must be greater than zero.", "invalid_amount", 400)

        expense_decimal = Decimal(str(amount_val))
        account.balance -= expense_decimal

        tx = Transaction(
            workspace_id=ws.id,
            account_id=account.id,
            category_id=payload.category_id or wish.category_id,
            type="expense",
            amount=expense_decimal,
            description=payload.description.strip() if payload.description else f"Fulfilled Wish: {wish.title}",
            transaction_date=date.today(),
        )
        db.session.add(tx)
        db.session.flush()
        wish.fulfilled_transaction_id = tx.id

    wish.status = "granted"
    wish.granted_at = datetime.now(timezone.utc)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        workspace_id=ws.id,
        event_type="wish_fulfilled",
        metadata_json={
            "wish_id": wish.id,
            "title": wish.title,
            "recorded_expense": payload.record_expense,
            "transaction_id": wish.fulfilled_transaction_id,
        },
        ip_address=ip_address,
    )

    return get_wish_detail(user, wish.id)
