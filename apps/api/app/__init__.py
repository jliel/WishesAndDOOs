import os
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException, TooManyRequests
from werkzeug.middleware.proxy_fix import ProxyFix

from app.config import CONFIG_MAP, Config, ProductionConfig
from app.extensions import cors, db, limiter, migrate
from app.modules.auth.routes import auth_bp
from app.modules.auth.service import ensure_demo_user_seeded
from app.modules.dashboard.routes import dashboard_bp
from app.modules.dashboard.service import ensure_demo_workspace_data_seeded
from app.modules.doos.routes import doos_bp
from app.modules.finances.routes import finances_bp
from app.modules.system.routes import system_bp
from app.modules.wishes.routes import wishes_bp
from app.modules.workspaces.routes import settings_bp, workspaces_bp


def create_app(config_class: type[Config] | None = None) -> Flask:
    """Flask Application Factory with security headers, domain models, and modular blueprints."""
    env = os.getenv("FLASK_ENV", "development").lower()
    if config_class is None:
        config_class = CONFIG_MAP.get(env, Config)

    if config_class is ProductionConfig:
        ProductionConfig.validate_secrets()

    app = Flask(__name__)
    app.config.from_object(config_class)

    # Apply ProxyFix when behind reverse proxies (Nginx, Traefik, Caddy, Cloudflare)
    if app.config.get("ENABLE_PROXY_FIX", False):
        app.wsgi_app = ProxyFix(
            app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1, x_prefix=1
        )

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )
    limiter.init_app(app)

    # Import models and initialize schema + optional seeded demo data
    with app.app_context():
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.doos import models as _doo_models  # noqa: F401
        from app.modules.finances import models as _finance_models  # noqa: F401
        from app.modules.wishes import models as _wish_models  # noqa: F401
        from app.modules.workspaces import models as _workspace_models  # noqa: F401

        auto_create = os.getenv("FLASK_AUTO_CREATE_DB", "true").lower() in (
            "true",
            "1",
            "yes",
        )
        # Default demo data seeding to false in production, true in development
        default_seed = "false" if env == "production" else "true"
        seed_demo = os.getenv("FLASK_SEED_DEMO_DATA", default_seed).lower() in (
            "true",
            "1",
            "yes",
        )

        if auto_create:
            db.create_all()

        if seed_demo:
            try:
                demo_user = ensure_demo_user_seeded()
                if demo_user and demo_user.workspace_memberships:
                    ensure_demo_workspace_data_seeded(
                        demo_user.workspace_memberships[0].workspace_id
                    )
            except Exception:
                pass

    # Register blueprints
    app.register_blueprint(system_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(finances_bp)
    app.register_blueprint(wishes_bp)
    app.register_blueprint(doos_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(workspaces_bp)

    # Clean standardized JSON error handlers
    @app.errorhandler(TooManyRequests)
    def handle_rate_limit_exceeded(err):
        return (
            jsonify(
                {
                    "error": "rate_limited",
                    "message": "Too many requests. Please wait a moment and try again.",
                }
            ),
            429,
        )

    @app.errorhandler(404)
    def handle_not_found(err):
        return (
            jsonify(
                {
                    "error": "not_found",
                    "message": "The requested resource was not found.",
                }
            ),
            404,
        )

    @app.errorhandler(405)
    def handle_method_not_allowed(err):
        return (
            jsonify(
                {
                    "error": "method_not_allowed",
                    "message": "The HTTP method is not allowed for this endpoint.",
                }
            ),
            405,
        )

    @app.errorhandler(500)
    def handle_internal_error(err):
        return (
            jsonify(
                {
                    "error": "internal_server_error",
                    "message": "An unexpected server error occurred. Please try again later.",
                }
            ),
            500,
        )

    # Apply security headers on every response
    @app.after_request
    def apply_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

    return app
