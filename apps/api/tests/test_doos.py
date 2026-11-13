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


def test_doos_list_requires_auth(client):
    response = client.get("/api/v1/doos")
    assert response.status_code == 401


def test_doos_crud_lifecycle_and_views(client):
    token, workspace_id = _login_demo(client)
    auth_headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a DOO
    create_payload = {
        "title": "Buy Birthday Present",
        "priority": "high",
        "status": "todo",
        "due_date": "2026-11-20",
        "recurrence_rule": "none",
        "notes": "Look for art supplies",
        "subtasks": [
            {"title": "Check wishlist prices", "sort_order": 0},
            {"title": "Order online", "sort_order": 1},
        ],
    }
    res = client.post("/api/v1/doos", json=create_payload, headers=auth_headers)
    assert res.status_code == 201
    doo_data = res.get_json()["doo"]
    doo_id = doo_data["id"]
    assert doo_data["title"] == "Buy Birthday Present"
    assert doo_data["priority"] == "high"
    assert doo_data["total_subtasks"] == 2
    assert doo_data["done_subtasks"] == 0
    assert doo_data["progress_percent"] == 0

    # 2. Get DOO detail
    res = client.get(f"/api/v1/doos/{doo_id}", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["doo"]["id"] == doo_id

    # 3. Toggle subtask
    subtasks = res.get_json()["doo"]["subtasks"]
    first_sub_id = subtasks[0]["id"]
    res = client.post(
        f"/api/v1/doos/{doo_id}/subtasks/{first_sub_id}/toggle",
        json={"is_completed": True},
        headers=auth_headers,
    )
    assert res.status_code == 200
    updated_doo = res.get_json()["doo"]
    assert updated_doo["done_subtasks"] == 1
    assert updated_doo["progress_percent"] == 50

    # 4. Toggle Doo Status
    res = client.post(f"/api/v1/doos/{doo_id}/toggle", headers=auth_headers)
    assert res.status_code == 200
    assert res.get_json()["doo"]["status"] == "done"

    # 5. List with views
    res = client.get("/api/v1/doos?view=all", headers=auth_headers)
    assert res.status_code == 200
    body = res.get_json()
    assert body["summary"]["total_doos"] >= 1
    assert any(d["id"] == doo_id for d in body["items"])

    # 6. Update Doo
    res = client.put(
        f"/api/v1/doos/{doo_id}",
        json={"title": "Updated Task Title", "priority": "low"},
        headers=auth_headers,
    )
    assert res.status_code == 200
    assert res.get_json()["doo"]["title"] == "Updated Task Title"
    assert res.get_json()["doo"]["priority"] == "low"

    # 7. Delete Doo
    res = client.delete(f"/api/v1/doos/{doo_id}", headers=auth_headers)
    assert res.status_code == 200

    # Verify deleted
    res = client.get(f"/api/v1/doos/{doo_id}", headers=auth_headers)
    assert res.status_code == 404
