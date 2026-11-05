from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from app.extensions import db
from app.modules.auth.models import User
from app.modules.auth.service import record_audit_event, seed_default_categories_for_workspace
from app.modules.doos.models import Doo, DooSubtask
from app.modules.finances.models import Account, Budget, SavingsGoal, Transaction
from app.modules.wishes.models import Wish
from app.modules.workspaces.models import Category, Workspace, WorkspaceMember


class DashboardError(Exception):
    """Domain error for dashboard operations."""

    def __init__(self, message: str, code: str = "bad_request", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def _to_float(val: Decimal | float | int | None) -> float:
    if val is None:
        return 0.0
    return round(float(val), 2)


def resolve_user_workspace(
    user: User, requested_workspace_id: str | None = None
) -> tuple[Workspace, WorkspaceMember]:
    """Resolve and authorize a workspace for the given user."""
    query = db.session.query(WorkspaceMember).filter_by(user_id=user.id)
    if requested_workspace_id:
        membership = query.filter_by(workspace_id=requested_workspace_id).first()
        if not membership or not membership.workspace:
            raise DashboardError(
                "You do not have access to this workspace.",
                code="forbidden",
                status_code=403,
            )
        return membership.workspace, membership

    membership = query.first()
    if not membership or not membership.workspace:
        raise DashboardError(
            "No active workspace found for this account.",
            code="workspace_not_found",
            status_code=404,
        )
    return membership.workspace, membership


def ensure_demo_workspace_data_seeded(workspace_id: str) -> None:
    """Idempotently seed rich Finance, Wish, and DOO data for the demo workspace."""
    existing_accounts = (
        db.session.query(Account).filter_by(workspace_id=workspace_id).count()
    )
    if existing_accounts > 0:
        return

    categories = seed_default_categories_for_workspace(workspace_id)
    db.session.flush()

    cat_map: dict[str, Category] = {c.name: c for c in categories}

    # Ensure category icons use MaterialIcons names even on existing DBs
    icon_fixes = {
        "Groceries & Dining": "restaurant",
        "Travel & Leisure": "flight",
        "Income & Salary": "account-balance-wallet",
        "Experiences & Travel": "explore",
        "Tech & Gear": "devices",
        "Home & Living": "auto-awesome",
        "Personal & Health": "favorite-border",
        "Household": "checklist",
        "Finance & Admin": "work-outline",
    }
    for c in categories:
        if c.name in icon_fixes and c.icon != icon_fixes[c.name]:
            c.icon = icon_fixes[c.name]

    today = datetime.now(timezone.utc).date()
    period_month = today.strftime("%Y-%m")

    # 1. Accounts (Total Net Balance = $24,580.00)
    checking = Account(
        workspace_id=workspace_id,
        name="Primary Checking",
        type="checking",
        balance=Decimal("8430.00"),
        icon="account-balance",
        color="finance",
    )
    vault = Account(
        workspace_id=workspace_id,
        name="High-Yield Vault",
        type="savings",
        balance=Decimal("15200.00"),
        icon="savings",
        color="finance",
    )
    cash = Account(
        workspace_id=workspace_id,
        name="Everyday Cash",
        type="cash",
        balance=Decimal("950.00"),
        icon="payments",
        color="finance",
    )
    db.session.add_all([checking, vault, cash])
    db.session.flush()

    # 2. Savings Goals
    goal_kyoto = SavingsGoal(
        workspace_id=workspace_id,
        account_id=vault.id,
        name="Kyoto Autumn Trip",
        target_amount=Decimal("3200.00"),
        current_amount=Decimal("2560.00"),
        target_date=today + timedelta(days=75),
        icon="flight",
        color="wish",
    )
    goal_studio = SavingsGoal(
        workspace_id=workspace_id,
        account_id=vault.id,
        name="Studio Display Setup",
        target_amount=Decimal("1600.00"),
        current_amount=Decimal("1200.00"),
        target_date=today + timedelta(days=45),
        icon="devices",
        color="finance",
    )
    goal_emergency = SavingsGoal(
        workspace_id=workspace_id,
        account_id=vault.id,
        name="Emergency Reserve",
        target_amount=Decimal("10000.00"),
        current_amount=Decimal("9000.00"),
        target_date=today + timedelta(days=120),
        icon="verified-user",
        color="finance",
    )
    db.session.add_all([goal_kyoto, goal_studio, goal_emergency])
    db.session.flush()

    # 3. Current-Month Transactions (Income: $6,850.00 | Expense: $2,340.00)
    cat_income = cat_map.get("Income & Salary")
    cat_housing = cat_map.get("Housing & Bills")
    cat_groceries = cat_map.get("Groceries & Dining")
    cat_travel = cat_map.get("Travel & Leisure")

    txs = [
        Transaction(
            workspace_id=workspace_id,
            account_id=checking.id,
            category_id=cat_income.id if cat_income else None,
            type="income",
            amount=Decimal("5850.00"),
            description="Monthly Product Design Salary",
            transaction_date=today.replace(day=1),
        ),
        Transaction(
            workspace_id=workspace_id,
            account_id=checking.id,
            category_id=cat_income.id if cat_income else None,
            type="income",
            amount=Decimal("1000.00"),
            description="UI/UX Advisory Retainer",
            transaction_date=today,
        ),
        Transaction(
            workspace_id=workspace_id,
            account_id=checking.id,
            category_id=cat_housing.id if cat_housing else None,
            type="expense",
            amount=Decimal("1450.00"),
            description="Apartment Rent & Fiber Internet",
            transaction_date=today.replace(day=1),
        ),
        Transaction(
            workspace_id=workspace_id,
            account_id=checking.id,
            category_id=cat_groceries.id if cat_groceries else None,
            type="expense",
            amount=Decimal("420.00"),
            description="Whole Foods Market & Specialty Coffee",
            transaction_date=today,
        ),
        Transaction(
            workspace_id=workspace_id,
            account_id=vault.id,
            category_id=cat_travel.id if cat_travel else None,
            savings_goal_id=goal_kyoto.id,
            type="expense",
            amount=Decimal("470.00"),
            description="Kyoto Rail & Ryokan Deposit",
            transaction_date=today,
        ),
    ]
    db.session.add_all(txs)

    # 4. Monthly Budgets
    budgets = []
    if cat_housing:
        budgets.append(
            Budget(
                workspace_id=workspace_id,
                category_id=cat_housing.id,
                monthly_limit=Decimal("1600.00"),
                period_month=period_month,
            )
        )
    if cat_groceries:
        budgets.append(
            Budget(
                workspace_id=workspace_id,
                category_id=cat_groceries.id,
                monthly_limit=Decimal("650.00"),
                period_month=period_month,
            )
        )
    if cat_travel:
        budgets.append(
            Budget(
                workspace_id=workspace_id,
                category_id=cat_travel.id,
                monthly_limit=Decimal("800.00"),
                period_month=period_month,
            )
        )
    db.session.add_all(budgets)

    # 5. Wishes (linked to Savings Goals)
    cat_exp = cat_map.get("Experiences & Travel")
    cat_tech = cat_map.get("Tech & Gear")
    cat_home = cat_map.get("Home & Living")

    wish_kyoto = Wish(
        workspace_id=workspace_id,
        category_id=cat_exp.id if cat_exp else None,
        savings_goal_id=goal_kyoto.id,
        title="Kyoto Autumn Trip",
        notes="10-day itinerary across Arashiyama, Gion, and Nara.",
        estimated_price=Decimal("3200.00"),
        priority="high",
        status="active",
    )
    wish_display = Wish(
        workspace_id=workspace_id,
        category_id=cat_tech.id if cat_tech else None,
        savings_goal_id=goal_studio.id,
        title="Apple Studio Display 5K",
        notes="27-inch 5K Retina monitor for design workstation.",
        estimated_price=Decimal("1599.00"),
        priority="medium",
        status="active",
    )
    wish_espresso = Wish(
        workspace_id=workspace_id,
        category_id=cat_home.id if cat_home else None,
        savings_goal_id=None,
        title="Espresso Bar Upgrade",
        notes="Precision burr grinder + bottomless portafilter.",
        estimated_price=Decimal("680.00"),
        priority="low",
        status="active",
    )
    db.session.add_all([wish_kyoto, wish_display, wish_espresso])
    db.session.flush()

    # 6. DOOs (Today's & Linked Tasks) + Subtasks
    cat_admin = cat_map.get("Finance & Admin")
    cat_household = cat_map.get("Household")

    doo_ryokan = Doo(
        workspace_id=workspace_id,
        wish_id=wish_kyoto.id,
        category_id=cat_exp.id if cat_exp else None,
        title="Book Ryokan in Arashiyama",
        notes="Confirm private onsen reservation for 3 nights.",
        priority="high",
        status="todo",
        due_date=today,
        recurrence_rule="none",
    )
    doo_vault = Doo(
        workspace_id=workspace_id,
        wish_id=None,
        category_id=cat_admin.id if cat_admin else None,
        title="Transfer $400 to High-Yield Vault",
        notes="Monthly automated savings allocation check.",
        priority="high",
        status="todo",
        due_date=today,
        recurrence_rule="monthly",
    )
    doo_jrpass = Doo(
        workspace_id=workspace_id,
        wish_id=wish_kyoto.id,
        category_id=cat_exp.id if cat_exp else None,
        title="Order JR Pass & ICOCA Cards",
        notes="Reserved green car regional passes.",
        priority="medium",
        status="done",
        due_date=today,
        completed_at=datetime.now(timezone.utc),
    )
    doo_desk = Doo(
        workspace_id=workspace_id,
        wish_id=wish_display.id,
        category_id=cat_household.id if cat_household else None,
        title="Measure VESA Mount Clearance",
        notes="Verify desk clamp depth before ordering.",
        priority="low",
        status="done",
        due_date=today,
        completed_at=datetime.now(timezone.utc),
    )
    db.session.add_all([doo_ryokan, doo_vault, doo_jrpass, doo_desk])
    db.session.flush()

    subtasks = [
        DooSubtask(
            doo_id=doo_ryokan.id,
            title="Compare half-board kaiseki options",
            is_completed=True,
            sort_order=1,
        ),
        DooSubtask(
            doo_id=doo_ryokan.id,
            title="Verify passport numbers for guest registry",
            is_completed=True,
            sort_order=2,
        ),
        DooSubtask(
            doo_id=doo_ryokan.id,
            title="Confirm credit card deposit authorization",
            is_completed=False,
            sort_order=3,
        ),
    ]
    db.session.add_all(subtasks)
    db.session.commit()


def get_dashboard_overview(
    user: User, requested_workspace_id: str | None = None
) -> dict[str, Any]:
    """Aggregate Finance, Budget Health, Savings Goals, Top Wishes, and Today's DOOs for a workspace."""
    workspace, membership = resolve_user_workspace(user, requested_workspace_id)
    workspace_id = workspace.id

    today = datetime.now(timezone.utc).date()
    period_month = today.strftime("%Y-%m")
    month_start = today.replace(day=1)

    categories = db.session.query(Category).filter_by(workspace_id=workspace_id).all()
    cat_by_id: dict[str, Category] = {c.id: c for c in categories}

    # 1. Accounts & Net Balance
    accounts = (
        db.session.query(Account)
        .filter_by(workspace_id=workspace_id)
        .order_by(Account.created_at.asc())
        .all()
    )
    total_net_balance = sum((_to_float(a.balance) for a in accounts), 0.0)

    # 2. Transactions (Current Month Income/Expense + Recent Activity)
    all_txs = (
        db.session.query(Transaction)
        .filter_by(workspace_id=workspace_id)
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .all()
    )
    monthly_txs = [tx for tx in all_txs if tx.transaction_date >= month_start]
    monthly_income = sum(
        (_to_float(tx.amount) for tx in monthly_txs if tx.type == "income"), 0.0
    )
    monthly_expense = sum(
        (_to_float(tx.amount) for tx in monthly_txs if tx.type == "expense"), 0.0
    )
    monthly_net_cashflow = round(monthly_income - monthly_expense, 2)
    savings_rate_pct = (
        round((monthly_net_cashflow / monthly_income) * 100, 1)
        if monthly_income > 0
        else 0.0
    )

    spent_by_category: dict[str, float] = {}
    for tx in monthly_txs:
        if tx.type == "expense" and tx.category_id:
            spent_by_category[tx.category_id] = round(
                spent_by_category.get(tx.category_id, 0.0) + _to_float(tx.amount), 2
            )

    recent_transactions = []
    for tx in all_txs[:5]:
        cat = cat_by_id.get(tx.category_id) if tx.category_id else None
        recent_transactions.append(
            {
                "id": tx.id,
                "description": tx.description,
                "amount": _to_float(tx.amount),
                "type": tx.type,
                "category_name": cat.name if cat else "General",
                "category_icon": cat.icon if cat else "receipt-long",
                "transaction_date": tx.transaction_date.isoformat(),
            }
        )

    # 3. Budget Health
    budgets = (
        db.session.query(Budget)
        .filter_by(workspace_id=workspace_id, period_month=period_month)
        .all()
    )
    budget_items = []
    total_budgeted = 0.0
    total_budget_spent = 0.0

    for b in budgets:
        limit_val = _to_float(b.monthly_limit)
        spent_val = spent_by_category.get(b.category_id, 0.0)
        remaining_val = round(max(0.0, limit_val - spent_val), 2)
        pct = round((spent_val / limit_val) * 100, 1) if limit_val > 0 else 0.0
        status = "over" if pct > 100 else ("warning" if pct >= 85 else "healthy")
        cat = cat_by_id.get(b.category_id)

        total_budgeted = round(total_budgeted + limit_val, 2)
        total_budget_spent = round(total_budget_spent + spent_val, 2)

        budget_items.append(
            {
                "id": b.id,
                "category_id": b.category_id,
                "category_name": cat.name if cat else "Category",
                "category_icon": cat.icon if cat else "pie-chart",
                "monthly_limit": limit_val,
                "spent": spent_val,
                "remaining": remaining_val,
                "utilization_pct": pct,
                "status": status,
            }
        )

    overall_budget_pct = (
        round((total_budget_spent / total_budgeted) * 100, 1)
        if total_budgeted > 0
        else 0.0
    )

    # 4. Savings Goals
    goals = (
        db.session.query(SavingsGoal)
        .filter_by(workspace_id=workspace_id)
        .order_by(SavingsGoal.created_at.asc())
        .all()
    )
    goals_by_id: dict[str, SavingsGoal] = {g.id: g for g in goals}
    total_saved = sum((_to_float(g.current_amount) for g in goals), 0.0)
    total_target = sum((_to_float(g.target_amount) for g in goals), 0.0)

    goal_items = []
    for g in goals:
        curr = _to_float(g.current_amount)
        targ = _to_float(g.target_amount)
        pct = round(min(100.0, (curr / targ) * 100), 1) if targ > 0 else 0.0
        goal_items.append(
            {
                "id": g.id,
                "name": g.name,
                "current_amount": curr,
                "target_amount": targ,
                "progress_pct": pct,
                "target_date": g.target_date.isoformat() if g.target_date else None,
                "icon": g.icon,
                "color": g.color,
            }
        )

    # 5. Wishes & DOOs
    all_wishes = (
        db.session.query(Wish)
        .filter_by(workspace_id=workspace_id)
        .order_by(Wish.created_at.asc())
        .all()
    )
    wishes_by_id: dict[str, Wish] = {w.id: w for w in all_wishes}
    active_wishes = [w for w in all_wishes if w.status == "active"]
    granted_wishes = [w for w in all_wishes if w.status == "granted"]

    all_doos = (
        db.session.query(Doo)
        .filter_by(workspace_id=workspace_id)
        .order_by(Doo.status.desc(), Doo.created_at.asc())
        .all()
    )

    doos_by_wish: dict[str, list[Doo]] = {}
    for d in all_doos:
        if d.wish_id:
            doos_by_wish.setdefault(d.wish_id, []).append(d)

    wish_items = []
    for w in active_wishes[:4]:
        cat = cat_by_id.get(w.category_id) if w.category_id else None
        linked_goal = goals_by_id.get(w.savings_goal_id) if w.savings_goal_id else None
        est_price = _to_float(w.estimated_price)
        funded_amt = _to_float(linked_goal.current_amount) if linked_goal else 0.0
        funded_pct = (
            round(min(100.0, (funded_amt / est_price) * 100), 1)
            if est_price > 0 and linked_goal
            else 0.0
        )
        linked_doos = doos_by_wish.get(w.id, [])
        done_doos = sum(1 for d in linked_doos if d.status == "done")

        wish_items.append(
            {
                "id": w.id,
                "title": w.title,
                "notes": w.notes,
                "estimated_price": est_price,
                "priority": w.priority,
                "status": w.status,
                "category_name": cat.name if cat else "Wish",
                "category_icon": cat.icon if cat else "auto-awesome",
                "savings_goal_name": linked_goal.name if linked_goal else None,
                "funded_amount": funded_amt,
                "funded_pct": funded_pct,
                "linked_doos_total": len(linked_doos),
                "linked_doos_completed": done_doos,
            }
        )

    # 6. Today's & Priority DOOs
    pending_doos = [d for d in all_doos if d.status != "done"]
    completed_doos = [d for d in all_doos if d.status == "done"]

    doo_items = []
    for d in all_doos[:6]:
        cat = cat_by_id.get(d.category_id) if d.category_id else None
        parent_wish = wishes_by_id.get(d.wish_id) if d.wish_id else None
        sub_total = len(d.subtasks) if d.subtasks else 0
        sub_done = sum(1 for s in d.subtasks if s.is_completed) if d.subtasks else 0

        doo_items.append(
            {
                "id": d.id,
                "title": d.title,
                "priority": d.priority,
                "status": d.status,
                "due_date": d.due_date.isoformat() if d.due_date else today.isoformat(),
                "recurrence_rule": d.recurrence_rule,
                "category_name": cat.name if cat else "Task",
                "category_icon": cat.icon if cat else "checklist",
                "wish_title": parent_wish.title if parent_wish else None,
                "subtasks_total": sub_total,
                "subtasks_done": sub_done,
            }
        )

    return {
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "type": workspace.type,
            "currency": workspace.currency,
            "role": membership.role,
        },
        "finance_summary": {
            "total_net_balance": round(total_net_balance, 2),
            "monthly_income": round(monthly_income, 2),
            "monthly_expense": round(monthly_expense, 2),
            "monthly_net_cashflow": monthly_net_cashflow,
            "savings_rate_pct": savings_rate_pct,
            "period_label": today.strftime("%B %Y"),
            "accounts": [
                {
                    "id": a.id,
                    "name": a.name,
                    "type": a.type,
                    "balance": _to_float(a.balance),
                    "icon": a.icon,
                    "color": a.color,
                }
                for a in accounts
            ],
            "recent_transactions": recent_transactions,
        },
        "budget_health": {
            "period_month": period_month,
            "total_budgeted": total_budgeted,
            "total_spent": total_budget_spent,
            "utilization_pct": overall_budget_pct,
            "categories": budget_items,
        },
        "savings_goals": {
            "total_saved": round(total_saved, 2),
            "total_target": round(total_target, 2),
            "items": goal_items,
        },
        "top_wishes": {
            "active_count": len(active_wishes),
            "granted_count": len(granted_wishes),
            "items": wish_items,
        },
        "todays_doos": {
            "pending_count": len(pending_doos),
            "completed_count": len(completed_doos),
            "items": doo_items,
        },
    }


def confirm_doo_status_update(
    user: User,
    doo_id: str,
    target_status: str,
    ip_address: str | None = None,
) -> dict[str, Any]:
    """Explicitly confirm and persist a DOO status transition ('todo' | 'done')."""
    if target_status not in ("todo", "in_progress", "done"):
        raise DashboardError(
            "Status must be 'todo', 'in_progress', or 'done'.",
            code="validation_error",
            status_code=422,
        )

    doo = db.session.get(Doo, doo_id)
    if not doo:
        raise DashboardError(
            "Task not found.",
            code="not_found",
            status_code=404,
        )

    membership = (
        db.session.query(WorkspaceMember)
        .filter_by(user_id=user.id, workspace_id=doo.workspace_id)
        .first()
    )
    if not membership or membership.role not in ("owner", "editor"):
        raise DashboardError(
            "You do not have permission to modify tasks in this workspace.",
            code="forbidden",
            status_code=403,
        )

    doo.status = target_status
    doo.completed_at = (
        datetime.now(timezone.utc) if target_status == "done" else None
    )

    record_audit_event(
        event_type="doo_status_confirmed",
        user_id=user.id,
        workspace_id=doo.workspace_id,
        ip_address=ip_address,
        metadata={"doo_id": doo.id, "status": target_status},
    )
    db.session.commit()

    return {
        "id": doo.id,
        "title": doo.title,
        "status": doo.status,
        "completed_at": doo.completed_at.isoformat() if doo.completed_at else None,
    }
