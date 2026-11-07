from flask import Flask, jsonify
from werkzeug.exceptions import TooManyRequests

from app.config import Config
from app.extensions import cors, db, limiter, migrate
from app.modules.auth.routes import auth_bp
from app.modules.auth.service import ensure_demo_user_seeded
from app.modules.dashboard.routes import dashboard_bp
from app.modules.dashboard.service import ensure_demo_workspace_data_seeded
from app.modules.finances.routes import finances_bp
from app.modules.system.routes import system_bp


def create_app(config_class: type[Config] = Config) -> Flask:
    """Flask Application Factory with security headers, domain models, and modular blueprints."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )
    limiter.init_app(app)

    # Import models and initialize schema + seeded demo user and overview data
    with app.app_context():
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.doos import models as _doo_models  # noqa: F401
        from app.modules.finances import models as _finance_models  # noqa: F401
        from app.modules.wishes import models as _wish_models  # noqa: F401
        from app.modules.workspaces import models as _workspace_models  # noqa: F401

        db.create_all()
        demo_user = ensure_demo_user_seeded()
        if demo_user and demo_user.workspace_memberships:
            ensure_demo_workspace_data_seeded(
                demo_user.workspace_memberships[0].workspace_id
            )

    # Register blueprints
    app.register_blueprint(system_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(finances_bp)

    @app.errorhandler(TooManyRequests)
    def handle_rate_limit_exceeded(err):
        return (
            jsonify(
                {
                    "error": "rate_limited",
                    "message": "Too many sign-in attempts from this address. Please wait a minute and try again.",
                }
            ),
            429,
        )

    # Apply security headers on every response
    @app.after_request
    def apply_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

    return app
