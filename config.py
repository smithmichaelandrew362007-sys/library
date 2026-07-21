import os

# ─── Database Configuration ──────────────────────────────────────────
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://neondb_owner:npg_CH56OhryMFei@ep-polished-river-atpapz0s.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require')
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'library.db') # Fallback/Legacy

# ─── Flask Configuration ─────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY', 'library-mgmt-secret-key-2026')
DEBUG = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
MAX_CONTENT_LENGTH = 100 * 1024 * 1024 # 100 MB max upload size

# ─── API Keys ────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

# ─── Google OAuth 2.0 ────────────────────────────────────────
# Get credentials at: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID     = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')


# ─── Email Notifications (Gmail SMTP) ─────────────────────────────
# MAIL_SENDER: your Gmail address
# MAIL_APP_PASSWORD: 16-character App Password from Google Account settings
#   How to get it: https://myaccount.google.com/apppasswords
MAIL_SENDER       = os.environ.get('MAIL_SENDER', '')
MAIL_APP_PASSWORD = os.environ.get('MAIL_APP_PASSWORD', '')

# ─── SMS Notifications (Fast2SMS — India) ────────────────────────────
# Sign up free at: https://fast2sms.com
FAST2SMS_API_KEY  = os.environ.get('FAST2SMS_API_KEY', '')

# ─── Library Business Rules ──────────────────────────────────────────
MAX_BOOKS_PER_MEMBER = 3        # Max books a student can borrow at once
LOAN_DAYS = 14                  # Default loan period in days
FINE_PER_DAY = 2                # Fine in ₹ per day after due date
MAX_FINE = 100                  # Maximum fine cap in ₹

# ─── App Metadata ────────────────────────────────────────────────────
APP_NAME = "Library"
APP_VERSION = "1.0.0"
