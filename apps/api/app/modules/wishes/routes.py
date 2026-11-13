from flask import Blueprint, current_app, g, jsonify, request, send_file
from pydantic import ValidationError

from app.core.decorators import require_auth
from app.core.storage import (
    StorageError,
    get_image_absolute_path,
    process_and_save_wish_image,
)
from app.modules.wishes.schemas import WishCreateRequest, WishFulfillRequest, WishUpdateRequest
from app.modules.wishes.service import (
    WishesError,
    create_wish,
    delete_wish,
    fulfill_wish,
    get_wish_detail,
    list_wishes,
    resolve_user_workspace,
    update_wish,
)

wishes_bp = Blueprint("wishes", __name__, url_prefix="/api/v1/wishes")


@wishes_bp.errorhandler(ValidationError)
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


@wishes_bp.errorhandler(WishesError)
def handle_wishes_error(err: WishesError):
    return jsonify({"error": err.code, "message": err.message}), err.status_code


@wishes_bp.errorhandler(StorageError)
def handle_storage_error(err: StorageError):
    return jsonify({"error": err.code, "message": err.message}), err.status_code


@wishes_bp.route("", methods=["GET"])
@require_auth
def list_wishes_route():
    workspace_id = request.args.get("workspace_id")
    status = request.args.get("status")
    priority = request.args.get("priority")
    category_id = request.args.get("category_id")

    payload = list_wishes(
        user=g.current_user,
        workspace_id=workspace_id,
        status=status,
        priority=priority,
        category_id=category_id,
    )
    return jsonify(payload), 200


@wishes_bp.route("", methods=["POST"])
@require_auth
def create_wish_route():
    raw_data = request.get_json(silent=True) or {}
    payload = WishCreateRequest.model_validate(raw_data)
    workspace_id = raw_data.get("workspace_id")

    created = create_wish(
        user=g.current_user,
        payload=payload,
        workspace_id=workspace_id,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "wish": created}), 201




@wishes_bp.route("/<string:wish_id>", methods=["GET"])
@require_auth
def get_wish_detail_route(wish_id: str):
    detail = get_wish_detail(user=g.current_user, wish_id=wish_id)
    return jsonify(detail), 200


@wishes_bp.route("/<string:wish_id>/fulfill", methods=["POST"])
@require_auth
def fulfill_wish_route(wish_id: str):
    raw_data = request.get_json(silent=True) or {}
    payload = WishFulfillRequest.model_validate(raw_data)
    fulfilled = fulfill_wish(
        user=g.current_user,
        wish_id=wish_id,
        payload=payload,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "fulfilled", "wish": fulfilled}), 200
@wishes_bp.route("/<string:wish_id>", methods=["PUT", "PATCH"])
@require_auth
def update_wish_route(wish_id: str):
    raw_data = request.get_json(silent=True) or {}
    payload = WishUpdateRequest.model_validate(raw_data)

    updated = update_wish(
        user=g.current_user,
        wish_id=wish_id,
        payload=payload,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "confirmed", "wish": updated}), 200


@wishes_bp.route("/<string:wish_id>", methods=["DELETE"])
@require_auth
def delete_wish_route(wish_id: str):
    delete_wish(
        user=g.current_user,
        wish_id=wish_id,
        ip_address=request.remote_addr,
    )
    return jsonify({"status": "deleted", "id": wish_id}), 200


@wishes_bp.route("/upload-image", methods=["POST"])
@require_auth
def upload_wish_image_route():
    if "file" not in request.files:
        raise StorageError("No file uploaded in 'file' field.", code="missing_file", status_code=400)

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        raise StorageError("Uploaded file has no filename.", code="invalid_filename", status_code=400)

    workspace_id = request.form.get("workspace_id")
    ws = resolve_user_workspace(g.current_user, workspace_id)

    file_bytes = uploaded_file.read()
    storage_key, filename = process_and_save_wish_image(
        file_bytes=file_bytes,
        original_filename=uploaded_file.filename,
        base_dir=current_app.config["BASE_DIR"],
        workspace_id=ws.id,
    )

    image_url = f"/api/v1/wishes/images/{filename}"
    return (
        jsonify(
            {
                "status": "uploaded",
                "storage_key": storage_key,
                "filename": filename,
                "image_url": image_url,
            }
        ),
        201,
    )


@wishes_bp.route("/images/<path:filename>", methods=["GET"])
def serve_wish_image_route(filename: str):
    parts = filename.split("_", 1)
    if len(parts) < 2:
        return jsonify({"error": "not_found", "message": "Image not found."}), 404

    target_workspace_id = parts[0]

    from app.core.security import (
        decode_access_token,
        verify_signed_image_token,
    )
    from app.extensions import db
    from app.modules.workspaces.models import WorkspaceMember

    # 1. Check for HMAC signed URL (?exp=...&sig=...)
    exp_param = request.args.get("exp")
    sig_param = request.args.get("sig")
    is_signed_valid = False
    if exp_param and sig_param:
        is_signed_valid = verify_signed_image_token(target_workspace_id, filename, exp_param, sig_param)
        if not is_signed_valid:
            return jsonify({"error": "unauthorized", "message": "Expired or invalid signed image URL."}), 401

    if not is_signed_valid:
        # 2. Check for Bearer token or ?token= access token
        auth_header = request.headers.get("Authorization", "")
        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        elif request.args.get("token"):
            token = request.args.get("token").strip()

        if not token:
            return (
                jsonify(
                    {
                        "error": "unauthorized",
                        "message": "Authentication required to view workspace images.",
                    }
                ),
                401,
            )

        try:
            payload = decode_access_token(token)
            user_id = payload.get("sub")
        except Exception:
            return (
                jsonify(
                    {
                        "error": "invalid_token",
                        "message": "Invalid or expired access token.",
                    }
                ),
                401,
            )

        membership = (
            db.session.query(WorkspaceMember)
            .filter_by(workspace_id=target_workspace_id, user_id=user_id)
            .first()
        )
        if not membership:
            return (
                jsonify(
                    {
                        "error": "forbidden",
                        "message": "Access denied to this workspace's media.",
                    }
                ),
                403,
            )

    clean_path = get_image_absolute_path(
        storage_key=f"wishes/{filename}",
        base_dir=current_app.config["BASE_DIR"],
    )
    response = send_file(clean_path, mimetype="image/webp")
    response.headers["Cache-Control"] = "private, no-store, max-age=0"
    return response
