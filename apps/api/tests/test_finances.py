import pytest

from app import create_app
from app.config import TestingConfig
from app.modules.auth.service import DEMO_EMAIL, DEMO_PASSWORD


@pytest.fixture
def client():
    app = create_app(TestingConfig)
    with app.test_client() as test_client:
        yield test_client


def _login_demo(client) -> tuple[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert resp.status_code == 200
    body = resp.get_json()
    return body["access_token"], body["workspaces"][0]["id"]


def test_finances_overview_requires_auth(client):
    resp = client.get("/api/v1/finances/overview")
    assert resp.status_code == 401
    assert resp.get_json()["error"] == "unauthorized"


def test_finances_overview_returns_seeded_data(client):
    token, workspace_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    resp = client.get(
        f"/api/v1/finances/overview?workspace_id={workspace_id}",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.get_json()

    assert data["workspace"]["id"] == workspace_id
    assert data["workspace"]["currency"] == "USD"
    assert data["summary"]["net_balance"] == 24580.0
    assert data["summary"]["monthly_income"] == 6850.0
    assert data["summary"]["monthly_expenses"] == 2340.0
    assert data["summary"]["net_savings"] == 4510.0
    assert len(data["accounts"]) == 3
    assert len(data["budgets"]) >= 3
    assert len(data["savings_goals"]) == 3
    assert len(data["categories"]) >= 3


def test_account_crud_lifecycle(client):
    token, workspace_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Account
    create_resp = client.post(
        "/api/v1/finances/accounts",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "name": "Emergency Cash Stash",
            "type": "cash",
            "balance": "500.00",
            "icon": "payments",
            "color": "finance",
        },
    )
    assert create_resp.status_code == 201
    acc_data = create_resp.get_json()["account"]
    acc_id = acc_data["id"]
    assert acc_data["name"] == "Emergency Cash Stash"
    assert acc_data["balance"] == 500.0
    assert acc_data["type"] == "cash"

    # 2. Update Account
    update_resp = client.put(
        f"/api/v1/finances/accounts/{acc_id}",
        headers=headers,
        json={"name": "Primary Cash Reserve", "color": "wish"},
    )
    assert update_resp.status_code == 200
    updated = update_resp.get_json()["account"]
    assert updated["name"] == "Primary Cash Reserve"
    assert updated["color"] == "wish"

    # 3. List Accounts
    list_resp = client.get(
        f"/api/v1/finances/accounts?workspace_id={workspace_id}",
        headers=headers,
    )
    assert list_resp.status_code == 200
    accounts = list_resp.get_json()["accounts"]
    assert any(a["id"] == acc_id for a in accounts)

    # 4. Delete Account
    del_resp = client.delete(
        f"/api/v1/finances/accounts/{acc_id}",
        headers=headers,
    )
    assert del_resp.status_code == 200
    assert del_resp.get_json()["status"] == "deleted"


def test_transactions_atomic_balance_updates(client):
    token, workspace_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Get accounts
    accs_resp = client.get(
        f"/api/v1/finances/accounts?workspace_id={workspace_id}",
        headers=headers,
    )
    checking_acc = next(
        a for a in accs_resp.get_json()["accounts"] if a["name"] == "Primary Checking"
    )
    initial_balance = checking_acc["balance"]

    # 1. Create Expense
    expense_resp = client.post(
        "/api/v1/finances/transactions",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "account_id": checking_acc["id"],
            "type": "expense",
            "amount": "120.50",
            "description": "Weekly Farmers Market",
            "transaction_date": "2026-11-07",
        },
    )
    assert expense_resp.status_code == 201
    expense_tx = expense_resp.get_json()["transaction"]
    assert expense_tx["amount"] == 120.50

    # Verify account balance decreased
    accs_resp2 = client.get(
        f"/api/v1/finances/accounts?workspace_id={workspace_id}",
        headers=headers,
    )
    checking_acc2 = next(
        a for a in accs_resp2.get_json()["accounts"] if a["id"] == checking_acc["id"]
    )
    assert checking_acc2["balance"] == round(initial_balance - 120.50, 2)

    # 2. Create Income
    income_resp = client.post(
        "/api/v1/finances/transactions",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "account_id": checking_acc["id"],
            "type": "income",
            "amount": "300.00",
            "description": "Freelance Consulting",
            "transaction_date": "2026-11-07",
        },
    )
    assert income_resp.status_code == 201

    # Verify balance increased
    accs_resp3 = client.get(
        f"/api/v1/finances/accounts?workspace_id={workspace_id}",
        headers=headers,
    )
    checking_acc3 = next(
        a for a in accs_resp3.get_json()["accounts"] if a["id"] == checking_acc["id"]
    )
    assert checking_acc3["balance"] == round(initial_balance - 120.50 + 300.00, 2)

    # 3. Delete Expense and verify balance restored
    del_resp = client.delete(
        f"/api/v1/finances/transactions/{expense_tx['id']}",
        headers=headers,
    )
    assert del_resp.status_code == 200

    accs_resp4 = client.get(
        f"/api/v1/finances/accounts?workspace_id={workspace_id}",
        headers=headers,
    )
    checking_acc4 = next(
        a for a in accs_resp4.get_json()["accounts"] if a["id"] == checking_acc["id"]
    )
    assert checking_acc4["balance"] == round(initial_balance + 300.00, 2)


def test_budget_upsert_and_spent_calculation(client):
    token, workspace_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Get categories
    cats_resp = client.get(
        f"/api/v1/finances/categories?workspace_id={workspace_id}",
        headers=headers,
    )
    assert cats_resp.status_code == 200
    category = cats_resp.get_json()["categories"][0]

    # Set Budget
    budget_resp = client.post(
        "/api/v1/finances/budgets",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "category_id": category["id"],
            "monthly_limit": "850.00",
        },
    )
    assert budget_resp.status_code == 200
    b_data = budget_resp.get_json()["budget"]
    assert b_data["monthly_limit"] == 850.0
    assert b_data["category_id"] == category["id"]


def test_savings_goal_lifecycle_and_funding(client):
    token, workspace_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Get checking account
    accs_resp = client.get(
        f"/api/v1/finances/accounts?workspace_id={workspace_id}",
        headers=headers,
    )
    checking_acc = accs_resp.get_json()["accounts"][0]
    initial_acc_balance = checking_acc["balance"]

    # 1. Create Goal
    create_goal_resp = client.post(
        "/api/v1/finances/savings-goals",
        headers=headers,
        json={
            "workspace_id": workspace_id,
            "name": "New Gaming Rig",
            "target_amount": "2500.00",
            "current_amount": "200.00",
            "target_date": "2026-12-31",
            "account_id": checking_acc["id"],
            "icon": "devices",
            "color": "wish",
        },
    )
    assert create_goal_resp.status_code == 201
    goal = create_goal_resp.get_json()["savings_goal"]
    goal_id = goal["id"]
    assert goal["target_amount"] == 2500.0
    assert goal["current_amount"] == 200.0
    assert goal["progress_percent"] == 8.0

    # 2. Fund Goal explicitly
    fund_resp = client.post(
        f"/api/v1/finances/savings-goals/{goal_id}/fund",
        headers=headers,
        json={
            "amount": "300.00",
            "account_id": checking_acc["id"],
            "description": "Monthly hardware allocation",
        },
    )
    assert fund_resp.status_code == 200
    fund_data = fund_resp.get_json()
    assert fund_data["goal"]["current_amount"] == 500.0
    assert fund_data["goal"]["progress_percent"] == 20.0
    assert fund_data["account"]["balance"] == round(initial_acc_balance - 300.0, 2)

    # 3. Delete Goal
    del_resp = client.delete(
        f"/api/v1/finances/savings-goals/{goal_id}",
        headers=headers,
    )
    assert del_resp.status_code == 200
    assert del_resp.get_json()["status"] == "deleted"


def test_tenant_isolation_between_different_users(client):
    # Register a new user B
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "User Beta",
            "email": "beta@test.com",
            "password": "Password123!Safe",
            "currency": "EUR",
        },
    )
    assert reg_resp.status_code == 201
    token_b = reg_resp.get_json()["access_token"]
    ws_b = reg_resp.get_json()["workspaces"][0]["id"]

    # Demo user A
    token_a, ws_a = _login_demo(client)

    # User B tries to view User A's overview -> Forbidden (403)
    resp = client.get(
        f"/api/v1/finances/overview?workspace_id={ws_a}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 403
    assert resp.get_json()["error"] == "forbidden"
