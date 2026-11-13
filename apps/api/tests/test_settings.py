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


def test_settings_requires_auth(client):
    res = client.get("/api/v1/settings/profile")
    assert res.status_code == 401


def test_profile_update_and_theme_preferences(client):
    token, ws_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get profile
    res = client.get("/api/v1/settings/profile", headers=headers)
    assert res.status_code == 200
    user_data = res.get_json()["user"]
    assert user_data["email"] == DEMO_EMAIL

    # 2. Update display name & theme
    res = client.put(
        "/api/v1/settings/profile",
        json={
            "display_name": "Alex Rivera Pro",
            "theme_style": "joyful",
            "color_mode": "dark",
        },
        headers=headers,
    )
    assert res.status_code == 200
    updated = res.get_json()["user"]
    assert updated["display_name"] == "Alex Rivera Pro"
    assert updated["theme_style"] == "joyful"
    assert updated["color_mode"] == "dark"


def test_workspace_settings_currency_update(client):
    token, ws_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.put(
        f"/api/v1/workspaces/{ws_id}",
        json={"name": "Alex Master Studio", "currency": "EUR"},
        headers=headers,
    )
    assert res.status_code == 200
    body = res.get_json()["workspace"]
    assert body["name"] == "Alex Master Studio"
    assert body["currency"] == "EUR"


def test_sessions_list_and_revoke(client):
    token, ws_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/settings/sessions", headers=headers)
    assert res.status_code == 200
    sessions = res.get_json()["sessions"]
    assert len(sessions) >= 1

    session_id = sessions[0]["id"]
    res = client.post(f"/api/v1/settings/sessions/{session_id}/revoke", headers=headers)
    assert res.status_code == 200


def test_change_password_workflow(client):
    token, ws_id = _login_demo(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Invalid current password -> 400
    res = client.post(
        "/api/v1/settings/change-password",
        json={"current_password": "WrongPassword123!", "new_password": "NewValidPassword123!"},
        headers=headers,
    )
    assert res.status_code == 400
    assert res.get_json()["error"] == "invalid_current_password"

    # 2. Weak new password -> 422
    res = client.post(
        "/api/v1/settings/change-password",
        json={"current_password": DEMO_PASSWORD, "new_password": "weak"},
        headers=headers,
    )
    assert res.status_code == 422
    assert res.get_json()["error"] in ("weak_password", "validation_error")

    # 3. Successful change
    res = client.post(
        "/api/v1/settings/change-password",
        json={"current_password": DEMO_PASSWORD, "new_password": "NewSecurePassword2026!"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.get_json()["message"] == "Password changed successfully."

    # 4. Old password rejected -> 401
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert old_login.status_code == 401

    # 5. New password accepted -> 200
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": "NewSecurePassword2026!"},
    )
    assert new_login.status_code == 200
