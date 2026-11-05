from datetime import datetime, timezone
from flask import Blueprint, current_app, jsonify
from sqlalchemy import text

from app.extensions import db

system_bp = Blueprint("system", __name__, url_prefix="/api/v1")


@system_bp.get("/health")
def health_check():
    """Health & capabilities endpoint used by the Welcome Screen and monitoring."""
    db_status = "connected"
    try:
        db.session.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return (
        jsonify(
            {
                "status": "ok",
                "service": current_app.config.get("APP_NAME", "WishesAndDOOs API"),
                "version": current_app.config.get("API_VERSION", "1.0.0"),
                "database": db_status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "features": {
                    "modules": ["finances", "wishes", "doos"],
                    "themes": ["classical", "pastel", "joyful"],
                    "modes": ["light", "dark", "system"],
                    "save_mode": "explicit_confirm",
                },
            }
        ),
        200,
    )
