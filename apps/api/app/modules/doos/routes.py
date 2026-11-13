from flask import Blueprint, g, jsonify, request
from pydantic import ValidationError

from app.core.decorators import require_auth
from app.modules.doos.schemas import (
    DooCreateRequest,
    DooToggleStatusRequest,
    DooUpdateRequest,
    SubtaskCreateRequest,
    SubtaskUpdateRequest,
)
from app.modules.doos.service import (
    DoosError,
    add_subtask,
    create_doo,
    delete_doo,
    delete_subtask,
    get_doo_detail,
    list_doos,
    toggle_doo_status,
    toggle_subtask,
    update_doo,
)

doos_bp = Blueprint("doos", __name__, url_prefix="/api/v1/doos")


@doos_bp.errorhandler(ValidationError)
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


@doos_bp.errorhandler(DoosError)
def handle_doos_error(err: DoosError):
    return jsonify({"error": err.code, "message": err.message}), err.status_code


@doos_bp.route("", methods=["GET"])
@require_auth
def get_doos_list():
    ws_id = request.args.get("workspace_id")
    view = request.args.get("view", "all")
    priority = request.args.get("priority")
    status = request.args.get("status")
    category_id = request.args.get("category_id")
    wish_id = request.args.get("wish_id")
    search = request.args.get("search")

    data = list_doos(
        user_id=g.current_user.id,
        workspace_id=ws_id,
        view=view,
        priority=priority,
        status=status,
        category_id=category_id,
        wish_id=wish_id,
        search=search,
    )
    return jsonify(data), 200


@doos_bp.route("/<string:doo_id>", methods=["GET"])
@require_auth
def get_doo(doo_id: str):
    data = get_doo_detail(user_id=g.current_user.id, doo_id=doo_id)
    return jsonify({"doo": data}), 200


@doos_bp.route("", methods=["POST"])
@require_auth
def create_doo_endpoint():
    body = request.get_json(silent=True) or {}
    validated = DooCreateRequest(**body)
    data = create_doo(user_id=g.current_user.id, payload=validated.model_dump())
    return jsonify({"doo": data, "message": "Task created successfully."}), 201


@doos_bp.route("/<string:doo_id>", methods=["PUT", "PATCH"])
@require_auth
def update_doo_endpoint(doo_id: str):
    body = request.get_json(silent=True) or {}
    validated = DooUpdateRequest(**body)
    data = update_doo(
        user_id=g.current_user.id,
        doo_id=doo_id,
        payload=validated.model_dump(exclude_unset=True),
    )
    return jsonify({"doo": data, "message": "Task updated successfully."}), 200


@doos_bp.route("/<string:doo_id>/toggle", methods=["POST"])
@require_auth
def toggle_doo_status_endpoint(doo_id: str):
    body = request.get_json(silent=True) or {}
    validated = DooToggleStatusRequest(**body)
    data = toggle_doo_status(
        user_id=g.current_user.id,
        doo_id=doo_id,
        target_status=validated.status,
    )
    return jsonify({"doo": data, "message": "Task status updated."}), 200


@doos_bp.route("/<string:doo_id>", methods=["DELETE"])
@require_auth
def delete_doo_endpoint(doo_id: str):
    delete_doo(user_id=g.current_user.id, doo_id=doo_id)
    return jsonify({"message": "Task deleted successfully."}), 200


@doos_bp.route("/<string:doo_id>/subtasks", methods=["POST"])
@require_auth
def add_subtask_endpoint(doo_id: str):
    body = request.get_json(silent=True) or {}
    validated = SubtaskCreateRequest(**body)
    data = add_subtask(
        user_id=g.current_user.id,
        doo_id=doo_id,
        title=validated.title,
        sort_order=validated.sort_order or 0,
    )
    return jsonify({"doo": data, "message": "Subtask added."}), 201


@doos_bp.route("/<string:doo_id>/subtasks/<string:subtask_id>/toggle", methods=["POST"])
@require_auth
def toggle_subtask_endpoint(doo_id: str, subtask_id: str):
    body = request.get_json(silent=True) or {}
    validated = SubtaskUpdateRequest(**body)
    data = toggle_subtask(
        user_id=g.current_user.id,
        doo_id=doo_id,
        subtask_id=subtask_id,
        is_completed=validated.is_completed,
    )
    return jsonify({"doo": data, "message": "Subtask updated."}), 200


@doos_bp.route("/<string:doo_id>/subtasks/<string:subtask_id>", methods=["DELETE"])
@require_auth
def delete_subtask_endpoint(doo_id: str, subtask_id: str):
    data = delete_subtask(
        user_id=g.current_user.id,
        doo_id=doo_id,
        subtask_id=subtask_id,
    )
    return jsonify({"doo": data, "message": "Subtask deleted."}), 200
