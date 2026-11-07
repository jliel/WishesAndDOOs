from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import extract, func

from app.extensions import db
from app.modules.auth.models import User
from app.modules.auth.service import record_audit_event
from app.modules.finances.models import Account, Budget, SavingsGoal, Transaction
from app.modules.finances.schemas import (
    AccountCreateRequest,
    AccountUpdateRequest,
    BudgetSetRequest,
    SavingsGoalCreateRequest,
    SavingsGoalFundRequest,
    SavingsGoalUpdateRequest,
    TransactionCreateRequest,
)
from app.modules.workspaces.models import Category, Workspace, WorkspaceMember


class FinancesError(Exception):
    """Domain error for financial operations."""

    def __init__(self, message: str, code: str = "bad_request", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code


def resolve_user_workspace(
    user: User, requested_workspace_id: str | None = None
) -> tuple[Workspace, WorkspaceMember]:
    """Resolve and authorize a workspace for the given user."""
    query = db.session.query(WorkspaceMember).filter_by(user_id=user.id)
    if requested_workspace_id:
        membership = query.filter_by(workspace_id=requested_workspace_id).first()
        if not membership or not membership.workspace:
            raise FinancesError(
                "You do not have access to this workspace.",
                code="forbidden",
                status_code=403,
            )
        return membership.workspace, membership

    membership = query.first()
    if not membership or not membership.workspace:
        raise FinancesError(
            "No active workspace found for this account.",
            code="workspace_not_found",
            status_code=404,
        )
    return membership.workspace, membership


def _to_float(val: Decimal | float | int | None) -> float:
    if val is None:
        return 0.0
    return round(float(val), 2)


def _serialize_account(account: Account) -> dict[str, Any]:
    return {
        "id": account.id,
        "workspace_id": account.workspace_id,
        "name": account.name,
        "type": account.type,
        "balance": _to_float(account.balance),
        "icon": account.icon,
        "color": account.color,
        "created_at": account.created_at.isoformat() if account.created_at else None,
    }


def _serialize_transaction(
    tx: Transaction, category: Category | None = None, account: Account | None = None
) -> dict[str, Any]:
    return {
        "id": tx.id,
        "workspace_id": tx.workspace_id,
        "account_id": tx.account_id,
        "account_name": account.name if account else "Account",
        "category_id": tx.category_id,
        "category_name": category.name if category else "Uncategorized",
        "category_icon": category.icon if category else "label-outline",
        "savings_goal_id": tx.savings_goal_id,
        "type": tx.type,
        "amount": _to_float(tx.amount),
        "description": tx.description,
        "transaction_date": (
            tx.transaction_date.isoformat() if tx.transaction_date else None
        ),
        "created_at": tx.created_at.isoformat() if tx.created_at else None,
    }


def _serialize_savings_goal(
    goal: SavingsGoal, account: Account | None = None
) -> dict[str, Any]:
    target = _to_float(goal.target_amount)
    current = _to_float(goal.current_amount)
    progress_pct = round((current / target * 100) if target > 0 else 0.0, 1)
    progress_pct = min(100.0, max(0.0, progress_pct))

    return {
        "id": goal.id,
        "workspace_id": goal.workspace_id,
        "account_id": goal.account_id,
        "account_name": account.name if account else None,
        "name": goal.name,
        "target_amount": target,
        "current_amount": current,
        "progress_percent": progress_pct,
        "target_date": goal.target_date.isoformat() if goal.target_date else None,
        "icon": goal.icon,
        "color": goal.color,
        "created_at": goal.created_at.isoformat() if goal.created_at else None,
    }


def _serialize_budget(
    budget: Budget | None, category: Category, spent_amount: Decimal
) -> dict[str, Any]:
    limit = _to_float(budget.monthly_limit) if budget else 0.0
    spent = _to_float(spent_amount)
    remaining = round(max(0.0, limit - spent), 2)
    pct = round((spent / limit * 100) if limit > 0 else 0.0, 1)

    return {
        "id": budget.id if budget else None,
        "category_id": category.id,
        "category_name": category.name,
        "category_icon": category.icon,
        "category_color": category.color,
        "monthly_limit": limit,
        "spent_amount": spent,
        "remaining_amount": remaining,
        "percentage_used": pct,
        "is_over_budget": spent > limit if limit > 0 else False,
        "period_month": (
            budget.period_month
            if budget
            else datetime.now(timezone.utc).strftime("%Y-%m")
        ),
    }


def list_accounts(user: User, workspace_id: str | None = None) -> list[dict[str, Any]]:
    workspace, _ = resolve_user_workspace(user, workspace_id)
    accounts = (
        db.session.query(Account)
        .filter_by(workspace_id=workspace.id)
        .order_by(Account.created_at.asc())
        .all()
    )
    return [_serialize_account(a) for a in accounts]


def create_account(
    user: User,
    payload: AccountCreateRequest,
    workspace_id: str | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    workspace, _ = resolve_user_workspace(user, workspace_id)

    account = Account(
        workspace_id=workspace.id,
        name=payload.name,
        type=payload.type,
        balance=payload.balance,
        icon=payload.icon,
        color=payload.color,
    )
    db.session.add(account)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="CREATE_ACCOUNT",
        ip_address=ip_address,
        metadata={
            "workspace_id": workspace.id,
            "account_id": account.id,
            "name": account.name,
            "type": account.type,
            "balance": str(account.balance),
        },
    )

    return _serialize_account(account)


def update_account(
    user: User,
    account_id: str,
    payload: AccountUpdateRequest,
    ip_address: str | None = None,
) -> dict[str, Any]:
    account = db.session.query(Account).filter_by(id=account_id).first()
    if not account:
        raise FinancesError("Account not found.", code="not_found", status_code=404)

    resolve_user_workspace(user, account.workspace_id)

    if payload.name is not None:
        cleaned_name = payload.name.strip()
        if not cleaned_name:
            raise FinancesError("Account name cannot be empty.", code="invalid_input")
        account.name = cleaned_name
    if payload.type is not None:
        account.type = payload.type
    if payload.icon is not None:
        account.icon = payload.icon
    if payload.color is not None:
        account.color = payload.color

    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="UPDATE_ACCOUNT",
        ip_address=ip_address,
        metadata={"account_id": account.id, "name": account.name},
    )

    return _serialize_account(account)


def delete_account(
    user: User, account_id: str, ip_address: str | None = None
) -> dict[str, str]:
    account = db.session.query(Account).filter_by(id=account_id).first()
    if not account:
        raise FinancesError("Account not found.", code="not_found", status_code=404)

    resolve_user_workspace(user, account.workspace_id)

    db.session.delete(account)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="DELETE_ACCOUNT",
        ip_address=ip_address,
        metadata={"account_id": account_id, "name": account.name},
    )

    return {"status": "deleted", "account_id": account_id}


def list_transactions(
    user: User,
    workspace_id: str | None = None,
    account_id: str | None = None,
    category_id: str | None = None,
    type_filter: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    workspace, _ = resolve_user_workspace(user, workspace_id)

    query = db.session.query(Transaction).filter_by(workspace_id=workspace.id)

    if account_id:
        query = query.filter_by(account_id=account_id)
    if category_id:
        query = query.filter_by(category_id=category_id)
    if type_filter and type_filter in {"income", "expense", "transfer"}:
        query = query.filter_by(type=type_filter)

    transactions = (
        query.order_by(
            Transaction.transaction_date.desc(), Transaction.created_at.desc()
        )
        .limit(min(limit, 200))
        .all()
    )

    cat_ids = {t.category_id for t in transactions if t.category_id}
    acc_ids = {t.account_id for t in transactions if t.account_id}

    categories = {
        c.id: c
        for c in db.session.query(Category).filter(Category.id.in_(cat_ids)).all()
    }
    accounts = {
        a.id: a for a in db.session.query(Account).filter(Account.id.in_(acc_ids)).all()
    }

    return [
        _serialize_transaction(
            tx,
            category=categories.get(tx.category_id),
            account=accounts.get(tx.account_id),
        )
        for tx in transactions
    ]


def create_transaction(
    user: User,
    payload: TransactionCreateRequest,
    workspace_id: str | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    workspace, _ = resolve_user_workspace(user, workspace_id)

    account = (
        db.session.query(Account)
        .filter_by(id=payload.account_id, workspace_id=workspace.id)
        .first()
    )
    if not account:
        raise FinancesError(
            "Selected account not found in this workspace.",
            code="account_not_found",
            status_code=404,
        )

    category = None
    if payload.category_id:
        category = (
            db.session.query(Category)
            .filter_by(id=payload.category_id, workspace_id=workspace.id)
            .first()
        )
        if not category:
            raise FinancesError(
                "Selected category not found.",
                code="category_not_found",
                status_code=404,
            )

    goal = None
    if payload.savings_goal_id:
        goal = (
            db.session.query(SavingsGoal)
            .filter_by(id=payload.savings_goal_id, workspace_id=workspace.id)
            .first()
        )
        if not goal:
            raise FinancesError(
                "Selected savings goal not found.",
                code="goal_not_found",
                status_code=404,
            )

    tx_date = payload.transaction_date or datetime.now(timezone.utc).date()

    tx = Transaction(
        workspace_id=workspace.id,
        account_id=account.id,
        category_id=category.id if category else None,
        savings_goal_id=goal.id if goal else None,
        type=payload.type,
        amount=payload.amount,
        description=payload.description,
        transaction_date=tx_date,
    )
    db.session.add(tx)

    # Atomic Balance Update
    if payload.type == "income":
        account.balance += payload.amount
    elif payload.type == "expense":
        account.balance -= payload.amount
        if goal:
            goal.current_amount += payload.amount
    elif payload.type == "transfer":
        account.balance -= payload.amount
        if goal:
            goal.current_amount += payload.amount

    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="CREATE_TRANSACTION",
        ip_address=ip_address,
        metadata={
            "transaction_id": tx.id,
            "type": tx.type,
            "amount": str(tx.amount),
            "account_id": account.id,
            "account_balance": str(account.balance),
        },
    )

    return _serialize_transaction(tx, category=category, account=account)


def delete_transaction(
    user: User, transaction_id: str, ip_address: str | None = None
) -> dict[str, str]:
    tx = db.session.query(Transaction).filter_by(id=transaction_id).first()
    if not tx:
        raise FinancesError(
            "Transaction not found.", code="not_found", status_code=404
        )

    resolve_user_workspace(user, tx.workspace_id)

    account = db.session.query(Account).filter_by(id=tx.account_id).first()
    if account:
        # Reverse balance impact
        if tx.type == "income":
            account.balance -= tx.amount
        elif tx.type in ("expense", "transfer"):
            account.balance += tx.amount

    if tx.savings_goal_id:
        goal = db.session.query(SavingsGoal).filter_by(id=tx.savings_goal_id).first()
        if goal:
            goal.current_amount = max(Decimal("0.00"), goal.current_amount - tx.amount)

    db.session.delete(tx)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="DELETE_TRANSACTION",
        ip_address=ip_address,
        metadata={
            "transaction_id": transaction_id,
            "amount": str(tx.amount),
            "type": tx.type,
        },
    )

    return {"status": "deleted", "transaction_id": transaction_id}


def list_budgets(
    user: User, workspace_id: str | None = None, period_month: str | None = None
) -> list[dict[str, Any]]:
    workspace, _ = resolve_user_workspace(user, workspace_id)

    today = datetime.now(timezone.utc).date()
    target_period = period_month or today.strftime("%Y-%m")

    year_str, month_str = target_period.split("-")
    target_year = int(year_str)
    target_month = int(month_str)

    finance_categories = (
        db.session.query(Category)
        .filter_by(workspace_id=workspace.id, module="finance")
        .order_by(Category.name.asc())
        .all()
    )

    budgets = (
        db.session.query(Budget)
        .filter_by(workspace_id=workspace.id, period_month=target_period)
        .all()
    )
    budget_map = {b.category_id: b for b in budgets}

    # Sum expenses for this month per category
    spent_rows = (
        db.session.query(
            Transaction.category_id,
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00")),
        )
        .filter(
            Transaction.workspace_id == workspace.id,
            Transaction.type == "expense",
            extract("year", Transaction.transaction_date) == target_year,
            extract("month", Transaction.transaction_date) == target_month,
        )
        .group_by(Transaction.category_id)
        .all()
    )
    spent_map = {row[0]: Decimal(str(row[1])) for row in spent_rows}

    results = []
    for cat in finance_categories:
        b = budget_map.get(cat.id)
        spent = spent_map.get(cat.id, Decimal("0.00"))
        results.append(_serialize_budget(b, cat, spent))

    return results


def set_budget(
    user: User,
    payload: BudgetSetRequest,
    workspace_id: str | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    workspace, _ = resolve_user_workspace(user, workspace_id)

    category = (
        db.session.query(Category)
        .filter_by(id=payload.category_id, workspace_id=workspace.id)
        .first()
    )
    if not category:
        raise FinancesError(
            "Selected category not found.",
            code="category_not_found",
            status_code=404,
        )

    target_period = (
        payload.period_month or datetime.now(timezone.utc).strftime("%Y-%m")
    )

    budget = (
        db.session.query(Budget)
        .filter_by(
            workspace_id=workspace.id,
            category_id=category.id,
            period_month=target_period,
        )
        .first()
    )

    if budget:
        budget.monthly_limit = payload.monthly_limit
    else:
        budget = Budget(
            workspace_id=workspace.id,
            category_id=category.id,
            monthly_limit=payload.monthly_limit,
            period_month=target_period,
        )
        db.session.add(budget)

    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="SET_BUDGET",
        ip_address=ip_address,
        metadata={
            "category_id": category.id,
            "period_month": target_period,
            "limit": str(payload.monthly_limit),
        },
    )

    # Compute spent
    year_str, month_str = target_period.split("-")
    spent_sum = (
        db.session.query(
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))
        )
        .filter(
            Transaction.workspace_id == workspace.id,
            Transaction.category_id == category.id,
            Transaction.type == "expense",
            extract("year", Transaction.transaction_date) == int(year_str),
            extract("month", Transaction.transaction_date) == int(month_str),
        )
        .scalar()
        or Decimal("0.00")
    )

    return _serialize_budget(budget, category, Decimal(str(spent_sum)))


def list_savings_goals(
    user: User, workspace_id: str | None = None
) -> list[dict[str, Any]]:
    workspace, _ = resolve_user_workspace(user, workspace_id)

    goals = (
        db.session.query(SavingsGoal)
        .filter_by(workspace_id=workspace.id)
        .order_by(SavingsGoal.created_at.asc())
        .all()
    )

    acc_ids = {g.account_id for g in goals if g.account_id}
    accounts = {
        a.id: a for a in db.session.query(Account).filter(Account.id.in_(acc_ids)).all()
    }

    return [
        _serialize_savings_goal(g, account=accounts.get(g.account_id)) for g in goals
    ]


def create_savings_goal(
    user: User,
    payload: SavingsGoalCreateRequest,
    workspace_id: str | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    workspace, _ = resolve_user_workspace(user, workspace_id)

    account = None
    if payload.account_id:
        account = (
            db.session.query(Account)
            .filter_by(id=payload.account_id, workspace_id=workspace.id)
            .first()
        )
        if not account:
            raise FinancesError(
                "Linked account not found.",
                code="account_not_found",
                status_code=404,
            )

    goal = SavingsGoal(
        workspace_id=workspace.id,
        name=payload.name,
        target_amount=payload.target_amount,
        current_amount=payload.current_amount,
        target_date=payload.target_date,
        account_id=account.id if account else None,
        icon=payload.icon,
        color=payload.color,
    )
    db.session.add(goal)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="CREATE_SAVINGS_GOAL",
        ip_address=ip_address,
        metadata={
            "goal_id": goal.id,
            "name": goal.name,
            "target": str(goal.target_amount),
            "current": str(goal.current_amount),
        },
    )

    return _serialize_savings_goal(goal, account=account)


def update_savings_goal(
    user: User,
    goal_id: str,
    payload: SavingsGoalUpdateRequest,
    ip_address: str | None = None,
) -> dict[str, Any]:
    goal = db.session.query(SavingsGoal).filter_by(id=goal_id).first()
    if not goal:
        raise FinancesError(
            "Savings goal not found.", code="not_found", status_code=404
        )

    resolve_user_workspace(user, goal.workspace_id)

    if payload.name is not None:
        cleaned = payload.name.strip()
        if not cleaned:
            raise FinancesError("Goal name cannot be empty.", code="invalid_input")
        goal.name = cleaned
    if payload.target_amount is not None:
        goal.target_amount = payload.target_amount
    if payload.target_date is not None:
        goal.target_date = payload.target_date
    if payload.account_id is not None:
        if payload.account_id == "":
            goal.account_id = None
        else:
            acc = (
                db.session.query(Account)
                .filter_by(id=payload.account_id, workspace_id=goal.workspace_id)
                .first()
            )
            if not acc:
                raise FinancesError(
                    "Selected account not found.",
                    code="account_not_found",
                    status_code=404,
                )
            goal.account_id = acc.id
    if payload.icon is not None:
        goal.icon = payload.icon
    if payload.color is not None:
        goal.color = payload.color

    db.session.commit()

    account = (
        db.session.query(Account).filter_by(id=goal.account_id).first()
        if goal.account_id
        else None
    )

    record_audit_event(
        user_id=user.id,
        event_type="UPDATE_SAVINGS_GOAL",
        ip_address=ip_address,
        metadata={"goal_id": goal.id, "name": goal.name},
    )

    return _serialize_savings_goal(goal, account=account)


def fund_savings_goal(
    user: User,
    goal_id: str,
    payload: SavingsGoalFundRequest,
    ip_address: str | None = None,
) -> dict[str, Any]:
    goal = db.session.query(SavingsGoal).filter_by(id=goal_id).first()
    if not goal:
        raise FinancesError(
            "Savings goal not found.", code="not_found", status_code=404
        )

    resolve_user_workspace(user, goal.workspace_id)

    account = (
        db.session.query(Account)
        .filter_by(id=payload.account_id, workspace_id=goal.workspace_id)
        .first()
    )
    if not account:
        raise FinancesError(
            "Account to fund from not found.",
            code="account_not_found",
            status_code=404,
        )

    # Deduct from account and increment goal
    account.balance -= payload.amount
    goal.current_amount += payload.amount

    # Create audit transaction
    desc = payload.description or f"Funded goal: {goal.name}"
    tx = Transaction(
        workspace_id=goal.workspace_id,
        account_id=account.id,
        savings_goal_id=goal.id,
        type="transfer",
        amount=payload.amount,
        description=desc,
        transaction_date=datetime.now(timezone.utc).date(),
    )
    db.session.add(tx)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="FUND_SAVINGS_GOAL",
        ip_address=ip_address,
        metadata={
            "goal_id": goal.id,
            "account_id": account.id,
            "amount": str(payload.amount),
            "new_goal_amount": str(goal.current_amount),
            "new_account_balance": str(account.balance),
        },
    )

    return {
        "status": "confirmed",
        "goal": _serialize_savings_goal(goal, account=account),
        "account": _serialize_account(account),
        "transaction": _serialize_transaction(tx, account=account),
    }


def delete_savings_goal(
    user: User, goal_id: str, ip_address: str | None = None
) -> dict[str, str]:
    goal = db.session.query(SavingsGoal).filter_by(id=goal_id).first()
    if not goal:
        raise FinancesError(
            "Savings goal not found.", code="not_found", status_code=404
        )

    resolve_user_workspace(user, goal.workspace_id)

    db.session.delete(goal)
    db.session.commit()

    record_audit_event(
        user_id=user.id,
        event_type="DELETE_SAVINGS_GOAL",
        ip_address=ip_address,
        metadata={"goal_id": goal_id, "name": goal.name},
    )

    return {"status": "deleted", "goal_id": goal_id}


def list_finance_categories(
    user: User, workspace_id: str | None = None
) -> list[dict[str, Any]]:
    workspace, _ = resolve_user_workspace(user, workspace_id)
    categories = (
        db.session.query(Category)
        .filter_by(workspace_id=workspace.id, module="finance")
        .order_by(Category.name.asc())
        .all()
    )
    return [
        {
            "id": c.id,
            "name": c.name,
            "icon": c.icon,
            "color": c.color,
            "module": c.module,
        }
        for c in categories
    ]


def get_finances_overview(
    user: User, workspace_id: str | None = None, period_month: str | None = None
) -> dict[str, Any]:
    """Aggregated financial overview for Screen 5 containing all 4 tabs' initial data."""
    workspace, _ = resolve_user_workspace(user, workspace_id)

    today = datetime.now(timezone.utc).date()
    target_period = period_month or today.strftime("%Y-%m")
    year_str, month_str = target_period.split("-")
    target_year = int(year_str)
    target_month = int(month_str)

    # 1. Accounts
    accounts = (
        db.session.query(Account)
        .filter_by(workspace_id=workspace.id)
        .order_by(Account.created_at.asc())
        .all()
    )
    serialized_accounts = [_serialize_account(a) for a in accounts]
    net_balance = sum((a["balance"] for a in serialized_accounts), 0.0)

    # 2. Monthly Income & Expense totals
    income_sum = (
        db.session.query(
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))
        )
        .filter(
            Transaction.workspace_id == workspace.id,
            Transaction.type == "income",
            extract("year", Transaction.transaction_date) == target_year,
            extract("month", Transaction.transaction_date) == target_month,
        )
        .scalar()
        or Decimal("0.00")
    )

    expense_sum = (
        db.session.query(
            func.coalesce(func.sum(Transaction.amount), Decimal("0.00"))
        )
        .filter(
            Transaction.workspace_id == workspace.id,
            Transaction.type == "expense",
            extract("year", Transaction.transaction_date) == target_year,
            extract("month", Transaction.transaction_date) == target_month,
        )
        .scalar()
        or Decimal("0.00")
    )

    monthly_income = _to_float(Decimal(str(income_sum)))
    monthly_expenses = _to_float(Decimal(str(expense_sum)))
    net_savings = round(monthly_income - monthly_expenses, 2)
    savings_rate = (
        round((net_savings / monthly_income * 100), 1) if monthly_income > 0 else 0.0
    )

    # 3. Recent Transactions
    transactions = (
        db.session.query(Transaction)
        .filter_by(workspace_id=workspace.id)
        .order_by(
            Transaction.transaction_date.desc(), Transaction.created_at.desc()
        )
        .limit(30)
        .all()
    )
    cat_ids = {t.category_id for t in transactions if t.category_id}
    acc_ids = {t.account_id for t in transactions if t.account_id}

    categories = {
        c.id: c
        for c in db.session.query(Category).filter(Category.id.in_(cat_ids)).all()
    }
    account_map = {a.id: a for a in accounts}

    serialized_transactions = [
        _serialize_transaction(
            tx,
            category=categories.get(tx.category_id),
            account=account_map.get(tx.account_id),
        )
        for tx in transactions
    ]

    # 4. Budgets
    budgets = list_budgets(user, workspace.id, target_period)

    # 5. Savings Goals
    goals = list_savings_goals(user, workspace.id)
    total_goals_target = sum((g["target_amount"] for g in goals), 0.0)
    total_goals_saved = sum((g["current_amount"] for g in goals), 0.0)

    # 6. Categories
    finance_categories = list_finance_categories(user, workspace.id)

    return {
        "workspace": {
            "id": workspace.id,
            "name": workspace.name,
            "currency": workspace.currency,
        },
        "period_month": target_period,
        "summary": {
            "net_balance": round(net_balance, 2),
            "monthly_income": monthly_income,
            "monthly_expenses": monthly_expenses,
            "net_savings": net_savings,
            "savings_rate": savings_rate,
            "total_goals_target": round(total_goals_target, 2),
            "total_goals_saved": round(total_goals_saved, 2),
            "accounts_count": len(serialized_accounts),
            "active_goals_count": len(goals),
        },
        "accounts": serialized_accounts,
        "transactions": serialized_transactions,
        "budgets": budgets,
        "savings_goals": goals,
        "categories": finance_categories,
    }
