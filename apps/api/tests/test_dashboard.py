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


def test_dashboard_overview_requires_authentication(client):
    resp = client.get("/api/v1/dashboard/overview")
    assert resp.status_code == 401
    assert resp.get_json()["error"] == "unauthorized"


def test_dashboard_overview_returns_seeded_finance_wishes_doos_summary(client):
    token, workspace_id = _login_demo(client)

    resp = client.get(
        f"/api/v1/dashboard/overview?workspace_id={workspace_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.get_json()

    # Workspace metadata
    assert data["workspace"]["id"] == workspace_id
    assert data["workspace"]["name"] == "Personal Workspace"
    assert data["workspace"]["currency"] == "USD"

    # Finance summary
    fin = data["finance_summary"]
    assert fin["total_net_balance"] == 24580.0
    assert fin["monthly_income"] == 6850.0
    assert fin["monthly_expense"] == 2340.0
    assert fin["monthly_net_cashflow"] == 4510.0
    assert len(fin["accounts"]) == 3
    assert len(fin["recent_transactions"]) == 5

    # Budget health
    budgets = data["budget_health"]
    assert budgets["total_budgeted"] == 3050.0
    assert budgets["total_spent"] == 2340.0
    assert len(budgets["categories"]) == 3

    # Savings goals
    goals = data["savings_goals"]
    assert goals["total_saved"] == 12760.0
    assert goals["total_target"] == 14800.0
    assert len(goals["items"]) == 3

    # Top Wishes
    wishes = data["top_wishes"]
    assert wishes["active_count"] == 3
    assert wishes["items"][0]["title"] == "Kyoto Autumn Trip"
    assert wishes["items"][0]["funded_pct"] == 80.0
    assert wishes["items"][0]["linked_doos_total"] == 2

    # Today's DOOs
    doos = data["todays_doos"]
    assert doos["pending_count"] == 2
    assert doos["completed_count"] == 2
    assert len(doos["items"]) == 4


def test_dashboard_doo_status_explicit_confirm_and_tenant_isolation(client):
    token, _ = _login_demo(client)

    overview_resp = client.get(
        "/api/v1/dashboard/overview",
        headers={"Authorization": f"Bearer {token}"},
    )
    doos = overview_resp.get_json()["todays_doos"]["items"]
    todo_item = next(item for item in doos if item["status"] == "todo")

    # Explicitly confirm marking DOO as done
    patch_resp = client.patch(
        f"/api/v1/dashboard/doos/{todo_item['id']}/status",
        json={"status": "done"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.get_json()["doo"]["status"] == "done"

    # Register a second user and verify tenant isolation (cannot access demo workspace or DOO)
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Marco Rossi",
            "email": "marco@wishesanddoos.app",
            "password": "MarcoPassword2026!",
            "currency": "EUR",
        },
    )
    assert reg_resp.status_code == 201
    other_token = reg_resp.get_json()["access_token"]
    demo_ws_id = overview_resp.get_json()["workspace"]["id"]

    # Attempting to read demo workspace overview with Marco's token -> 403
    forbidden_overview = client.get(
        f"/api/v1/dashboard/overview?workspace_id={demo_ws_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden_overview.status_code == 403

    # Attempting to modify demo DOO with Marco's token -> 403
    forbidden_patch = client.patch(
        f"/api/v1/dashboard/doos/{todo_item['id']}/status",
        json={"status": "todo"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert forbidden_patch.status_code == 403
