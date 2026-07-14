import os

# ─── Database Configuration ──────────────────────────────────────────
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:npg_CH56OhryMFei@ep-polished-river-atpapz0s-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require')
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'library.db') # Fallback/Legacy

# ─── Flask Configuration ─────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY', 'library-mgmt-secret-key-2026')
DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'

# ─── Library Business Rules ──────────────────────────────────────────
MAX_BOOKS_PER_MEMBER = 3        # Max books a student can borrow at once
LOAN_DAYS = 14                  # Default loan period in days
FINE_PER_DAY = 2                # Fine in ₹ per day after due date
MAX_FINE = 100                  # Maximum fine cap in ₹

# ─── App Metadata ────────────────────────────────────────────────────
APP_NAME = "LibraVault"
APP_VERSION = "1.0.0"
