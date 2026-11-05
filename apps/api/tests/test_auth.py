import pytest

from app import create_app
from app.config import TestingConfig
from app.modules.auth.service import DEMO_EMAIL, DEMO_PASSWORD


class RateLimitedTestingConfig(TestingConfig):
    RATELIMIT_ENABLED = True


@pytest.fixture()
def client():
    app = create_app(TestingConfig)
    with app.test_client() as test_client:
        yield test_client


def test_login_with_seeded_demo_account_succeeds(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200
    data = response.get_json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "Bearer"
    assert data["user"]["email"] == DEMO_EMAIL
    assert data["user"]["display_name"] == "Alex Rivera"
    assert data["user"]["theme_style"] == "classical"
    assert len(data["workspaces"]) == 1
    assert data["workspaces"][0]["name"] == "Personal Workspace"
    assert data["workspaces"][0]["role"] == "owner"

    # HttpOnly cookie is set for Web clients
    set_cookie = response.headers.get("Set-Cookie", "")
    assert "wad_refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_login_validation_rejects_malformed_email(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "not-an-email", "password": "secret"},
    )
    assert response.status_code == 400
    data = response.get_json()
    assert data["error"] == "validation_error"
    assert "email" in data["field_errors"]


def test_login_with_wrong_password_or_unknown_email_returns_generic_401(client):
    # Wrong password
    resp1 = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": "WrongPassword999!"},
    )
    assert resp1.status_code == 401
    assert resp1.get_json()["error"] == "invalid_credentials"

    # Unknown email
    resp2 = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@wishesanddoos.app", "password": "WrongPassword999!"},
    )
    assert resp2.status_code == 401
    assert resp2.get_json()["error"] == "invalid_credentials"
    assert resp1.get_json()["message"] == resp2.get_json()["message"]


def test_account_lockout_after_five_failed_attempts(client):
    for attempt in range(4):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": DEMO_EMAIL, "password": f"WrongPass{attempt}"},
        )
        assert resp.status_code == 401

    # 5th failed attempt locks the account
    fifth_resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": "WrongPassFinal"},
    )
    assert fifth_resp.status_code == 429
    fifth_data = fifth_resp.get_json()
    assert fifth_data["error"] == "account_locked"
    assert fifth_data["retry_after_seconds"] > 0

    # Even valid password is blocked while locked
    blocked_resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert blocked_resp.status_code == 429
    assert blocked_resp.get_json()["error"] == "account_locked"


def test_me_endpoint_requires_bearer_token_and_returns_profile(client):
    unauth_resp = client.get("/api/v1/auth/me")
    assert unauth_resp.status_code == 401

    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    access_token = login_resp.get_json()["access_token"]

    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.get_json()
    assert me_data["user"]["email"] == DEMO_EMAIL
    assert me_data["workspaces"][0]["name"] == "Personal Workspace"


def test_refresh_token_rotation_and_reuse_detection(client):
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    first_refresh_token = login_resp.get_json()["refresh_token"]

    # Rotate once -> succeeds and issues a new refresh token
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh_token},
    )
    assert refresh_resp.status_code == 200
    second_refresh_token = refresh_resp.get_json()["refresh_token"]
    assert second_refresh_token != first_refresh_token

    # Replaying the old (already rotated) refresh token triggers reuse detection
    reuse_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": first_refresh_token},
    )
    assert reuse_resp.status_code == 401
    assert reuse_resp.get_json()["error"] == "refresh_token_reused"

    # The second refresh token is also revoked because reuse was detected on that user
    revoked_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": second_refresh_token},
    )
    assert revoked_resp.status_code == 401


def test_logout_revokes_session(client):
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    refresh_token = login_resp.get_json()["refresh_token"]

    logout_resp = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 200

    # Refreshing after logout fails
    refresh_after_logout = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_after_logout.status_code == 401


def test_flask_limiter_blocks_excessive_login_requests():
    app = create_app(RateLimitedTestingConfig)
    with app.test_client() as rate_client:
        statuses = []
        for _ in range(6):
            res = rate_client.post(
                "/api/v1/auth/login",
                json={"email": "ratetest@wishesanddoos.app", "password": "pass"},
            )
            statuses.append(res.status_code)

        assert 429 in statuses


def test_register_creates_user_workspace_categories_and_session(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Elena Gomez",
            "email": "Elena@WishesAndDOOs.app",
            "password": "StrongPass2026!",
            "currency": "MXN",
        },
    )
    assert response.status_code == 201
    data = response.get_json()

    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "elena@wishesanddoos.app"
    assert data["user"]["display_name"] == "Elena Gomez"
    assert len(data["workspaces"]) == 1
    assert data["workspaces"][0]["name"] == "Personal Workspace"
    assert data["workspaces"][0]["currency"] == "MXN"
    assert data["workspaces"][0]["role"] == "owner"
    assert data["workspaces"][0]["categories_count"] == 10

    set_cookie = response.headers.get("Set-Cookie", "")
    assert "wad_refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie


def test_register_rejects_duplicate_email(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Another Alex",
            "email": DEMO_EMAIL,
            "password": "StrongPass2026!",
            "currency": "USD",
        },
    )
    assert response.status_code == 409
    data = response.get_json()
    assert data["error"] == "email_already_registered"
    assert "email" in data["field_errors"]


def test_register_enforces_password_strength_rules(client):
    # Too short (< 10 chars)
    short_resp = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Sam User",
            "email": "sam@wishesanddoos.app",
            "password": "Short1!",
        },
    )
    assert short_resp.status_code == 400
    assert "password" in short_resp.get_json()["field_errors"]

    # Missing uppercase or number/symbol
    weak_resp = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": "Sam User",
            "email": "sam@wishesanddoos.app",
            "password": "alllowercaseletters",
        },
    )
    assert weak_resp.status_code == 400
    assert "password" in weak_resp.get_json()["field_errors"]

