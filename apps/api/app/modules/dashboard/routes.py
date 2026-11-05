from flask import Blueprint, g, jsonify, request

from app.core.decorators import require_auth
from app.modules.dashboard.service import (
    DashboardError,
    confirm_doo_status_update,
    ensure_demo_workspace_data_seeded,
    get_dashboard_overview,
    resolve_user_workspace,
)

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/v1/dashboard")


@dashboard_bp.route("/overview", methods=["GET"])
@require_auth
def overview_route():
    """Return aggregated Finance, Budget, Savings Goal, Wish, and DOO overview for the active workspace."""
    workspace_id = request.args.get("workspace_id")
    try:
        payload = get_dashboard_overview(g.current_user, workspace_id)
        return jsonify(payload), 200
    except DashboardError as err:
        return jsonify({"error": err.code, "message": err.message}), err.status_code


@dashboard_bp.route("/doos/<string:doo_id>/status", methods=["PATCH"])
@require_auth
def confirm_doo_status_route(doo_id: str):
    """Explicit Save & Confirm endpoint for updating a DOO's status from the Dashboard."""
    raw_data = request.get_json(silent=True) or {}
    target_status = str(raw_data.get("status", "")).strip()

    try:
        updated = confirm_doo_status_update(
            user=g.current_user,
            doo_id=doo_id,
            target_status=target_status,
            ip_address=request.remote_addr,
        )
        return (
            jsonify(
                {
                    "status": "confirmed",
                    "doo": updated,
                }
            ),
            200,
        )
    except DashboardError as err:
        return jsonify({"error": err.code, "message": err.message}), err.status_code


@dashboard_bp.route("/seed-sample", methods=["POST"])
@require_auth
def seed_sample_workspace_route():
    """Allow an authenticated owner to explicitly populate sample overview data in an empty workspace."""
    raw_data = request.get_json(silent=True) or {}
    workspace_id = raw_data.get("workspace_id")
    try:
        workspace, membership = resolve_user_workspace(g.current_user, workspace_id)
        if membership.role != "owner":
            return (
                jsonify(
                    {
                        "error": "forbidden",
                        "message": "Only workspace owners can seed sample data.",
                    }
                ),
                403,
            )
        ensure_demo_workspace_data_seeded(workspace.id)
        payload = get_dashboard_overview(g.current_user, workspace.id)
        return jsonify(payload), 200
    except DashboardError as err:
        return jsonify({"error": err.code, "message": err.message}), err.status_code
