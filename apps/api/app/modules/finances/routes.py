from flask import Blueprint, g, jsonify, request
from pydantic import ValidationError

from app.core.decorators import require_auth
from app.modules.finances.schemas import (
    AccountCreateRequest,
    AccountUpdateRequest,
    BudgetSetRequest,
    SavingsGoalCreateRequest,
    SavingsGoalFundRequest,
    SavingsGoalUpdateRequest,
    TransactionCreateRequest,
)
from app.modules.finances.service import (
    FinancesError,
    create_account,
    create_savings_goal,
    create_transaction,
    delete_account,
    delete_savings_goal,
    delete_transaction,
    fund_savings_goal,
    get_finances_overview,
    list_accounts,
    list_budgets,
    list_finance_categories,
    list_savings_goals,
    list_transactions,
    set_budget,
    update_account,
    update_savings_goal,
)

finances_bp = Blueprint("finances", __name__, url_prefix="/api/v1/finances")


@finances_bp.errorhandler(ValidationError)
def handle_validation_error(err: ValidationError):
    first_error = err.errors()[0]
    field = ".".join(str(loc) for loc in first_error.get("loc", []))
    msg = first_error.get("msg", "Invalid input.")
    return (
        jsonify(
            {
                "error": "validation_error",
                "field": field,
                "message": msg,
            }
        ),
        422,
    )


@finances_bp.errorhandler(FinancesError)
def handle_finances_error(err: FinancesError):
    return jsonify({"error": err.code, "message": err.message}), err.status_code


@finances_bp.route("/overview", methods=["GET"])
@require_auth
def finances_overview_route():
    workspace_id = request.args.get("workspace_id")
    period_month = request.args.get("period_month")
    payload = get_finances_overview(
        user=g.current_user, workspace_id=workspace_id, period_month=period_month
    )
    return jsonify(payload), 200


@finances_bp.route("/accounts", methods=["GET"])
@require_auth
def list_accounts_route():
    workspace_id = request.args.get("workspace_id")
    data = list_accounts(user=g.current_user, workspace_id=workspace_id)
    return jsonify({"accounts": data}), 200


@finances_bp.route("/accounts", methods=["POST"])
@require_auth
def create_account_route():
    raw_data = request.get_json(silent=True) or {}
    payload = AccountCreateRequest.model_validate(raw_data)
    workspace_id = raw_data.get("workspace_id")
    created = create_account(
        user=g.current_user,
        payload=payload,
        workspace_id=workspace_id,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "account": created}), 201


@finances_bp.route("/accounts/<string:account_id>", methods=["PUT", "PATCH"])
@require_auth
def update_account_route(account_id: str):
    raw_data = request.get_json(silent=True) or {}
    payload = AccountUpdateRequest.model_validate(raw_data)
    updated = update_account(
        user=g.current_user,
        account_id=account_id,
        payload=payload,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "account": updated}), 200


@finances_bp.route("/accounts/<string:account_id>", methods=["DELETE"])
@require_auth
def delete_account_route(account_id: str):
    res = delete_account(
        user=g.current_user, account_id=account_id, ip_address=request.remote_addr
    )
    return jsonify(res), 200


@finances_bp.route("/transactions", methods=["GET"])
@require_auth
def list_transactions_route():
    workspace_id = request.args.get("workspace_id")
    account_id = request.args.get("account_id")
    category_id = request.args.get("category_id")
    type_filter = request.args.get("type")
    limit = int(request.args.get("limit", 100))
    data = list_transactions(
        user=g.current_user,
        workspace_id=workspace_id,
        account_id=account_id,
        category_id=category_id,
        type_filter=type_filter,
        limit=limit,
    )
    return jsonify({"transactions": data}), 200


@finances_bp.route("/transactions", methods=["POST"])
@require_auth
def create_transaction_route():
    raw_data = request.get_json(silent=True) or {}
    payload = TransactionCreateRequest.model_validate(raw_data)
    workspace_id = raw_data.get("workspace_id")
    created = create_transaction(
        user=g.current_user,
        payload=payload,
        workspace_id=workspace_id,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "transaction": created}), 201


@finances_bp.route("/transactions/<string:transaction_id>", methods=["DELETE"])
@require_auth
def delete_transaction_route(transaction_id: str):
    res = delete_transaction(
        user=g.current_user,
        transaction_id=transaction_id,
        ip_address=request.remote_addr,
    )
    return jsonify(res), 200


@finances_bp.route("/budgets", methods=["GET"])
@require_auth
def list_budgets_route():
    workspace_id = request.args.get("workspace_id")
    period_month = request.args.get("period_month")
    data = list_budgets(
        user=g.current_user, workspace_id=workspace_id, period_month=period_month
    )
    return jsonify({"budgets": data}), 200


@finances_bp.route("/budgets", methods=["POST"])
@require_auth
def set_budget_route():
    raw_data = request.get_json(silent=True) or {}
    payload = BudgetSetRequest.model_validate(raw_data)
    workspace_id = raw_data.get("workspace_id")
    budget = set_budget(
        user=g.current_user,
        payload=payload,
        workspace_id=workspace_id,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "budget": budget}), 200


@finances_bp.route("/savings-goals", methods=["GET"])
@require_auth
def list_savings_goals_route():
    workspace_id = request.args.get("workspace_id")
    data = list_savings_goals(user=g.current_user, workspace_id=workspace_id)
    return jsonify({"savings_goals": data}), 200


@finances_bp.route("/savings-goals", methods=["POST"])
@require_auth
def create_savings_goal_route():
    raw_data = request.get_json(silent=True) or {}
    payload = SavingsGoalCreateRequest.model_validate(raw_data)
    workspace_id = raw_data.get("workspace_id")
    goal = create_savings_goal(
        user=g.current_user,
        payload=payload,
        workspace_id=workspace_id,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "savings_goal": goal}), 201


@finances_bp.route("/savings-goals/<string:goal_id>", methods=["PUT", "PATCH"])
@require_auth
def update_savings_goal_route(goal_id: str):
    raw_data = request.get_json(silent=True) or {}
    payload = SavingsGoalUpdateRequest.model_validate(raw_data)
    updated = update_savings_goal(
        user=g.current_user,
        goal_id=goal_id,
        payload=payload,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "savings_goal": updated}), 200


@finances_bp.route("/savings-goals/<string:goal_id>/fund", methods=["POST"])
@require_auth
def fund_savings_goal_route(goal_id: str):
    raw_data = request.get_json(silent=True) or {}
    payload = SavingsGoalFundRequest.model_validate(raw_data)
    res = fund_savings_goal(
        user=g.current_user,
        goal_id=goal_id,
        payload=payload,
        ip_address=request.remote_addr,
    )
    return jsonify(res), 200


@finances_bp.route("/savings-goals/<string:goal_id>", methods=["DELETE"])
@require_auth
def delete_savings_goal_route(goal_id: str):
    res = delete_savings_goal(
        user=g.current_user, goal_id=goal_id, ip_address=request.remote_addr
    )
    return jsonify(res), 200


@finances_bp.route("/categories", methods=["GET"])
@require_auth
def list_categories_route():
    workspace_id = request.args.get("workspace_id")
    data = list_finance_categories(user=g.current_user, workspace_id=workspace_id)
    return jsonify({"categories": data}), 200
