import pytest

from app import create_app
from app.config import TestingConfig


@pytest.fixture()
def client():
    app = create_app(TestingConfig)
    with app.test_client() as test_client:
        yield test_client


def test_health_endpoint_returns_ok_and_theme_capabilities(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200

    payload = response.get_json()
    assert payload["status"] == "ok"
    assert payload["service"] == "WishesAndDOOs API"
    assert payload["database"] == "connected"
    assert payload["features"]["themes"] == ["classical", "pastel", "joyful"]
    assert payload["features"]["modes"] == ["light", "dark", "system"]
    assert payload["features"]["save_mode"] == "explicit_confirm"


def test_security_headers_are_applied(client):
    response = client.get("/api/v1/health")
    assert response.headers.get("X-Content-Type-Options") == "nosniff"
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
