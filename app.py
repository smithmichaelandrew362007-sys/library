"""
LibraVault — Library Management System
Flask Application Entry Point
"""

# Load .env file automatically (must be before config import)
import os
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

from flask import Flask, redirect, url_for, send_from_directory
import config
from models import init_database

# ─── Create Flask App ────────────────────────────────────────
app = Flask(__name__)
app.secret_key = config.SECRET_KEY

# ─── Initialize Cache ────────────────────────────────────────
from utils.cache import cache
cache.init_app(app, config={'CACHE_TYPE': 'SimpleCache', 'CACHE_DEFAULT_TIMEOUT': 60})

# ─── Register Blueprints ─────────────────────────────────────
from routes.auth import auth_bp
from routes.books import books_bp
from routes.members import members_bp
from routes.issues import issues_bp
from routes.dashboard import dashboard_bp
from routes.oauth import oauth_bp, init_oauth

app.register_blueprint(auth_bp)
app.register_blueprint(books_bp)
app.register_blueprint(members_bp)
app.register_blueprint(issues_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(oauth_bp)

# ─── Initialize Google OAuth ──────────────────────────────────
init_oauth(app)


# ─── Error Handlers ──────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return redirect(url_for('auth.login'))

@app.route('/sw.js')
def serve_sw():
    response = send_from_directory('static', 'sw.js')
    response.headers['Cache-Control'] = 'no-cache'
    return response

@app.route('/manifest.json')
def serve_manifest():
    return send_from_directory('static', 'manifest.json')


@app.errorhandler(500)
def server_error(e):
    import traceback
    tb = traceback.format_exc()
    original_err = getattr(e, 'original_exception', e)
    return {'error': 'Internal server error', 'details': str(original_err), 'traceback': tb}, 500


# ─── Initialize Database & Run ────────────────────────────────
if __name__ == '__main__':
    print(f"""
    ============================================
      {config.APP_NAME} v{config.APP_VERSION}
      Library Management System
    ============================================
      Web:     http://localhost:5000
      Admin:   admin / admin123
      Student: arun / student123
    ============================================
    """)

    # Auto-initialize database on first run
    try:
        init_database()
    except Exception as e:
        print(f"[WARNING] Database init error: {e}")
        print("  Make sure MySQL is running and credentials in config.py are correct.")

    app.run(host='0.0.0.0', port=5000, debug=config.DEBUG)
