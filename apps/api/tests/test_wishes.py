import io
from PIL import Image
import pytest
from app import create_app
from app.config import TestingConfig
from app.extensions import db


@pytest.fixture
def app_instance():
    app = create_app(TestingConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app_instance):
    return app_instance.test_client()


def get_auth_token(client):
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@wishesanddoos.app", "password": "DemoPassword123!"},
    )
    assert login_res.status_code == 200
    return login_res.get_json()["access_token"]


def test_wishes_list_requires_auth(client):
    res = client.get("/api/v1/wishes")
    assert res.status_code == 401


def test_wishes_list_returns_seeded_data(client):
    token = get_auth_token(client)
    res = client.get("/api/v1/wishes", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.get_json()
    assert "workspace" in data
    assert "summary" in data
    assert "wishes" in data
    assert isinstance(data["wishes"], list)


def test_wish_crud_lifecycle(client):
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a Wish
    create_res = client.post(
        "/api/v1/wishes",
        headers=headers,
        json={
            "title": "Noise-Cancelling Headphones",
            "notes": "Sony WH-1000XM5 in silver",
            "estimated_price": 349.99,
            "priority": "high",
            "url": "https://example.com/headphones",
        },
    )
    assert create_res.status_code == 201
    created_wish = create_res.get_json()["wish"]
    wish_id = created_wish["id"]
    assert created_wish["title"] == "Noise-Cancelling Headphones"
    assert created_wish["priority"] == "high"
    assert created_wish["estimated_price"] == 349.99
    assert created_wish["status"] == "active"

    # 2. Update the Wish
    update_res = client.put(
        f"/api/v1/wishes/{wish_id}",
        headers=headers,
        json={
            "title": "Sony WH-1000XM5 Headphones",
            "priority": "medium",
            "status": "granted",
        },
    )
    assert update_res.status_code == 200
    updated_wish = update_res.get_json()["wish"]
    assert updated_wish["title"] == "Sony WH-1000XM5 Headphones"
    assert updated_wish["priority"] == "medium"
    assert updated_wish["status"] == "granted"
    assert updated_wish["granted_at"] is not None

    # 3. Filter Wishes
    filter_res = client.get(
        "/api/v1/wishes?status=granted",
        headers=headers,
    )
    assert filter_res.status_code == 200
    wishes = filter_res.get_json()["wishes"]
    assert any(w["id"] == wish_id for w in wishes)

    # 4. Delete the Wish
    delete_res = client.delete(
        f"/api/v1/wishes/{wish_id}",
        headers=headers,
    )
    assert delete_res.status_code == 200

    # Verify gone
    list_res = client.get("/api/v1/wishes", headers=headers)
    assert not any(w["id"] == wish_id for w in list_res.get_json()["wishes"])


def test_wish_image_upload_and_exif_stripping(client):
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # Generate a small in-memory test image
    img = Image.new("RGB", (100, 100), color=(124, 58, 237))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="PNG")
    img_byte_arr.seek(0)

    upload_res = client.post(
        "/api/v1/wishes/upload-image",
        headers=headers,
        data={"file": (img_byte_arr, "test_wish.png")},
        content_type="multipart/form-data",
    )
    assert upload_res.status_code == 201
    upload_data = upload_res.get_json()
    assert upload_data["status"] == "uploaded"
    assert "storage_key" in upload_data
    assert "filename" in upload_data
    assert upload_data["filename"].endswith(".webp")

    # Verify serving the clean image with authorization checks (H2 fix)
    filename = upload_data["filename"]

    # 1. Without token -> 401
    anon_res = client.get(f"/api/v1/wishes/images/{filename}")
    assert anon_res.status_code == 401
    assert anon_res.get_json()["error"] == "unauthorized"

    # 2. With another user's token -> 403
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"display_name": "Other User", "email": "other_img@test.com", "password": "Password123!Safe", "currency": "USD"},
    )
    other_token = reg_res.get_json()["access_token"]
    forbidden_res = client.get(f"/api/v1/wishes/images/{filename}", headers={"Authorization": f"Bearer {other_token}"})
    assert forbidden_res.status_code == 403
    assert forbidden_res.get_json()["error"] == "forbidden"

    # 3. With Bearer token -> 200
    auth_res = client.get(f"/api/v1/wishes/images/{filename}", headers=headers)
    assert auth_res.status_code == 200
    assert auth_res.content_type == "image/webp"

    # 4. With ?token= query parameter -> 200
    query_res = client.get(f"/api/v1/wishes/images/{filename}?token={token}")
    assert query_res.status_code == 200
    assert query_res.content_type == "image/webp"
    assert query_res.headers.get("Cache-Control") == "private, no-store, max-age=0"

    # 5. With HMAC signed URL -> 200
    from app.core.security import generate_signed_image_token
    workspace_id = filename.split("_", 1)[0]
    exp, sig = generate_signed_image_token(workspace_id, filename)
    signed_res = client.get(f"/api/v1/wishes/images/{filename}?exp={exp}&sig={sig}")
    assert signed_res.status_code == 200
    assert signed_res.content_type == "image/webp"

    # 6. With expired/forged HMAC signature -> 401
    bad_signed_res = client.get(f"/api/v1/wishes/images/{filename}?exp={exp}&sig=forged_invalid_signature")
    assert bad_signed_res.status_code == 401


def test_wish_detail_and_fulfill_workflow(client):
    token = get_auth_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Get accounts to find a funding wallet
    accs_res = client.get("/api/v1/finances/accounts", headers=headers)
    assert accs_res.status_code == 200
    account = accs_res.get_json()["accounts"][0]
    initial_balance = float(account["balance"])

    # 2. Create a high-priority Wish
    create_res = client.post(
        "/api/v1/wishes",
        headers=headers,
        json={
            "title": "Ergonomic Mechanical Keyboard",
            "estimated_price": 220.00,
            "priority": "high",
            "notes": "Custom split keyboard with silent switches",
        },
    )
    assert create_res.status_code == 201
    wish_id = create_res.get_json()["wish"]["id"]

    # 3. Retrieve Wish Detail
    detail_res = client.get(f"/api/v1/wishes/{wish_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.get_json()
    assert detail["id"] == wish_id
    assert detail["title"] == "Ergonomic Mechanical Keyboard"
    assert "linked_doos" in detail
    assert detail["status"] == "active"
    assert detail["fulfilled_transaction"] is None

    # 4. Fulfill Wish with expense logging
    fulfill_res = client.post(
        f"/api/v1/wishes/{wish_id}/fulfill",
        headers=headers,
        json={
            "record_expense": True,
            "account_id": account["id"],
            "expense_amount": 220.00,
            "description": "Bought Ergonomic Mechanical Keyboard",
        },
    )
    assert fulfill_res.status_code == 200
    fulfilled_data = fulfill_res.get_json()
    assert fulfilled_data["status"] == "fulfilled"
    assert fulfilled_data["wish"]["status"] == "granted"
    assert fulfilled_data["wish"]["granted_at"] is not None
    assert fulfilled_data["wish"]["fulfilled_transaction"] is not None
    assert fulfilled_data["wish"]["fulfilled_transaction"]["amount"] == 220.00

    # 5. Verify account balance was deducted atomically
    accs_res_after = client.get("/api/v1/finances/accounts", headers=headers)
    account_after = next(a for a in accs_res_after.get_json()["accounts"] if a["id"] == account["id"])
    assert round(float(account_after["balance"]), 2) == round(initial_balance - 220.00, 2)
