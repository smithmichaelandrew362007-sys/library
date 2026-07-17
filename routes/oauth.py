"""
routes/oauth.py
───────────────
Handles Google OAuth 2.0 sign-in for students.

Flow:
  1. Student clicks "Sign in with Google" on login page
  2. /auth/google  →  redirects to Google's consent screen
  3. Google redirects back to /auth/google/callback
  4. We verify the token, look up or auto-create the member, and log them in

Setup required (one-time, per the implementation plan):
  - Create OAuth 2.0 credentials at https://console.cloud.google.com/apis/credentials
  - Add Authorized Redirect URI: http://localhost:5000/auth/google/callback
  - Set env vars: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
"""

from flask import Blueprint, redirect, url_for, session, request, flash, current_app
from authlib.integrations.flask_client import OAuth
from models import get_db
import os

oauth_bp = Blueprint('oauth', __name__)

# ─── OAuth client (registered in app.py) ─────────────────────────────
oauth = OAuth()

def init_oauth(app):
    """Call this from app.py after creating the Flask app."""
    import config
    google_client_id     = config.GOOGLE_CLIENT_ID
    google_client_secret = config.GOOGLE_CLIENT_SECRET

    # Authlib Flask integration expects these in app.config
    app.config['GOOGLE_CLIENT_ID'] = google_client_id
    app.config['GOOGLE_CLIENT_SECRET'] = google_client_secret

    print(f"[DEBUG OAUTH] Client ID length: {len(google_client_id)}")
    print(f"[DEBUG OAUTH] Client ID starts with: {google_client_id[:5] if google_client_id else 'None'}")
    print(f"[DEBUG OAUTH] ENV GOOGLE_CLIENT_ID: {__import__('os').environ.get('GOOGLE_CLIENT_ID', 'Missing')}")

    oauth.init_app(app)

    if not google_client_id or not google_client_secret:
        app.logger.warning("Google OAuth missing!")
    else:
        app.logger.info(f"Google OAuth configured with client_id: {google_client_id[:20]}...")

    oauth.register(
        name='google',
        client_id=google_client_id,
        client_secret=google_client_secret,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'},
    )


# ─── Routes ──────────────────────────────────────────────────────────

@oauth_bp.route('/auth/google/login')
def google_login():
    """Step 1: Redirect user to Google sign-in page."""
    # Hardcode redirect_uri to guarantee it matches Google Cloud Console config.
    # url_for(_external=True) can omit the port in some environments (Electron, proxies).
    redirect_uri = request.host_url.rstrip('/') + '/auth/google/callback'
    return oauth.google.authorize_redirect(redirect_uri)


@oauth_bp.route('/auth/google/callback')
def google_callback():
    """Step 2: Google returns here after the user grants permission."""
    try:
        token = oauth.google.authorize_access_token()
    except Exception as e:
        flash(f'Google sign-in failed: {e}', 'danger')
        return redirect(url_for('auth.login'))

    user_info = token.get('userinfo')
    if not user_info:
        flash('Could not retrieve your Google account information.', 'danger')
        return redirect(url_for('auth.login'))

    google_id = user_info.get('sub')   # Unique Google user ID
    email     = user_info.get('email')
    name      = user_info.get('name', email)

    conn   = get_db()
    cursor = conn.cursor()

    # ── 1. Check if a member already linked this Google account ───────
    cursor.execute(
        "SELECT * FROM members WHERE google_id = %s AND status = 'active'",
        (google_id,)
    )
    member = cursor.fetchone()

    # ── 2. No google_id match — try to link by email ──────────────────
    if not member and email:
        cursor.execute(
            "SELECT * FROM members WHERE email = %s AND status = 'active'",
            (email,)
        )
        member = cursor.fetchone()
        if member:
            # Link their Google ID going forward
            cursor.execute(
                "UPDATE members SET google_id = %s WHERE member_id = %s",
                (google_id, member['member_id'])
            )
            conn.commit()

    # ── 3. Still no match — auto-create a student account ─────────────
    if not member:
        # Generate a username from email prefix
        base_username = email.split('@')[0].lower().replace('.', '_')
        username = base_username
        counter  = 1
        while True:
            cursor.execute(
                "SELECT 1 FROM members WHERE username = %s", (username,)
            )
            if not cursor.fetchone():
                break
            username = f"{base_username}{counter}"
            counter += 1

        cursor.execute(
            """INSERT INTO members (name, roll_no, email, google_id, username, password, role, status)
               VALUES (%s, %s, %s, %s, %s, '', 'student', 'active')
               RETURNING *""",
            (name, f"GOOGLE-{google_id[:8]}", email, google_id, username)
        )
        member = cursor.fetchone()
        conn.commit()
        flash(
            f'Welcome, {name}! Your account has been created automatically. '
            'Please ask the librarian to update your Roll No and Department.',
            'info'
        )

    conn.close()

    # ── 4. Block admin accounts from using Google login ───────────────
    if member['role'] == 'admin':
        flash('Admins must use username and password to log in.', 'warning')
        return redirect(url_for('auth.login'))

    # ── 5. Log the user in ────────────────────────────────────────────
    session['member_id'] = member['member_id']
    session['role']      = member['role']
    session['name']      = member['name']
    flash(f"Welcome back, {member['name']}!", 'success')
    return redirect(url_for('dashboard.index'))
