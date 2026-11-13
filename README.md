# WishesAndDOOs

> A modern, approachable, and privacy-first unified workspace for Wishlists, Actionable Tasks ("DOOs"), and Personal Finances.

---

## Architecture Overview

* **Frontend (`apps/client`):** Universal Expo (React Native + Web/PWA) + Expo Router v4 + NativeWind v4 + `shadcn/ui` primitives + TanStack Query v5 + 2-Axis Semantic Theme Token Engine (`classical`, `pastel`, `joyful` $\times$ `light`, `dark`).
* **Backend (`apps/api`):** Python Flask (Application Factory + Modular Blueprints) + SQLAlchemy 2.0 + Alembic + Pydantic v2 + Argon2id password hashing + rotating JWT refresh sessions.
* **Storage & Privacy:** EXIF-stripped WebP private image storage with HMAC-SHA256 signed URLs.
* **Database:** PostgreSQL 15+ (Production) / SQLite (Local Dev fallback).

---

## Getting Started (Local Development)

### Prerequisites
* Node.js $\ge$ 20
* Python $\ge$ 3.12

### 1. Backend Setup
```bash
cd apps/api
python -m venv .venv

# On Linux/macOS:
source .venv/bin/activate
# On Windows PowerShell:
.venv\Scripts\Activate.ps1

pip install -r requirements.txt
python -m flask --app wsgi.py run --port 5000
```
The API starts at `http://localhost:5000/api/v1/health` with automatic local SQLite database initialization.

### 2. Frontend Setup
```bash
cd apps/client
npm install
npm run web
```
The client starts at `http://localhost:8081`.

---

## Production Deployment (Docker Compose)

The production stack orchestrates **PostgreSQL 15**, **Flask Gunicorn API**, and a multi-stage **Nginx Expo Web SPA** on an internal bridge network with healthchecks.

### 1. Generate Secure Production Secrets
Run the following in Python to generate high-entropy 32-byte hexadecimal secrets:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Configure Production Environment
Copy the production environment template:
```bash
cp .env.production.example .env.production
```
Edit `.env.production` with your generated values:
```dotenv
POSTGRES_USER=wad_user
POSTGRES_PASSWORD=<strong_random_password>
POSTGRES_DB=wishes_and_doos

SECRET_KEY=<32_byte_random_hex>
JWT_SECRET_KEY=<32_byte_random_hex>

CORS_ORIGINS=https://yourdomain.com
EXPO_PUBLIC_API_URL=/api/v1
WEB_PORT=80
```

### 3. Launch Stack
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

### 4. Verify Services
```bash
# Check running containers and health status:
docker compose -f docker-compose.prod.yml ps

# Check API health endpoint through Nginx:
curl -i http://localhost/api/v1/health
```

---

## Database Migrations Runbook

Alembic migrations are maintained in `apps/api/migrations`.

### Applying Migrations
In production containers, migrations are automatically applied on container boot via `entrypoint.sh`. To run them manually:
```bash
cd apps/api
flask --app wsgi.py db upgrade
```

### Creating New Migrations
When modifying SQLAlchemy domain models:
```bash
cd apps/api
flask --app wsgi.py db migrate -m "describe_schema_changes"
flask --app wsgi.py db upgrade
```

---

## Automated Testing & Quality Gates

Run the test suites across both projects before committing or deploying:

```bash
# Backend Pytest Suite (37 automated tests)
cd apps/api
PYTHONPATH=. pytest -v

# Frontend Typecheck & Unit Tests (27 automated tests)
cd apps/client
npm run typecheck
npm test

# Production Static Web Export Check
npm run build:web
```

---

## Security Architecture

* **Argon2id Hashing:** Password hashing uses OWASP-recommended parameters (`time_cost=2`, `memory_cost=19456`, `parallelism=1`).
* **Session Lifecycle:** 15-minute JWT access tokens paired with rotating refresh tokens stored hashed (`SHA-256`) in `user_sessions`.
* **HttpOnly Cookies:** Web refresh tokens are isolated in `HttpOnly`, `Secure`, `SameSite=Lax` cookies; tokens are never persisted in Web `localStorage`.
* **Tenant Isolation:** Every domain record (`wishes`, `doos`, `accounts`, `transactions`, `budgets`, `savings_goals`, `categories`) is strictly isolated by `workspace_id`.
* **Media Privacy:** Uploaded images have camera and GPS EXIF metadata stripped, are converted to clean WebP, and are protected behind HMAC-SHA256 signed URLs and workspace membership checks.
