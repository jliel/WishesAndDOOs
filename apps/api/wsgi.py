import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    # Production uses Gunicorn or Waitress; local direct execution binds 127.0.0.1 without debug
    app.run(host="127.0.0.1", port=port, debug=False)
