import config
from flask import Blueprint, url_for, redirect, request, session, flash, current_app
from authlib.integrations.flask_client import OAuth
from models import get_db

oauth_bp = Blueprint('oauth', __name__)
oauth = OAuth()

def init_oauth(app):
    """Initialize Authlib OAuth with Flask app and setup Google Client."""
    oauth.init_app(app)
    
    # We use config.py credentials
    app.config['GOOGLE_CLIENT_ID'] = config.GOOGLE_CLIENT_ID
    app.config['GOOGLE_CLIENT_SECRET'] = config.GOOGLE_CLIENT_SECRET
    
    oauth.register(
        name='google',
        client_id=config.GOOGLE_CLIENT_ID,
        client_secret=config.GOOGLE_CLIENT_SECRET,
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={
            'scope': 'openid email profile'
        }
    )

@oauth_bp.route('/auth/google/login')
def google_login():
    """Redirect to Google's consent screen."""
    redirect_uri = url_for('oauth.google_callback', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@oauth_bp.route('/auth/google/callback')
def google_callback():
    """Handle the callback from Google."""
    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get('userinfo')
        if not user_info:
            flash("Failed to retrieve user information from Google.", "error")
            return redirect(url_for('auth.login'))
            
        google_id = user_info.get('sub')
        email = user_info.get('email')
        name = user_info.get('name', 'Google User')
        
        # Connect to DB to check if user exists
        conn = get_db()
        cursor = conn.cursor()
        
        # 1. Check if google_id already exists in DB
        cursor.execute("SELECT * FROM members WHERE google_id = %s", (google_id,))
        member = cursor.fetchone()
        
        if member:
            # Login successful
            session['member_id'] = member['member_id']
            session['role'] = member['role']
            session['name'] = member['name']
            conn.close()
            return redirect(url_for('dashboard.index'))
            
        # 2. Check if email already exists, if so link the account
        cursor.execute("SELECT * FROM members WHERE email = %s", (email,))
        member_by_email = cursor.fetchone()
        
        if member_by_email:
            # Link Google ID to existing user
            cursor.execute("UPDATE members SET google_id = %s WHERE member_id = %s", (google_id, member_by_email['member_id']))
            conn.commit()
            
            session['member_id'] = member_by_email['member_id']
            session['role'] = member_by_email['role']
            session['name'] = member_by_email['name']
            conn.close()
            flash("Your Google account has been linked to your existing profile.", "success")
            return redirect(url_for('dashboard.index'))
            
        # 3. Create a new user (Student)
        import random
        # Generate a random username and roll_no since Google doesn't provide them
        username = email.split('@')[0] + str(random.randint(100,999))
        roll_no = f"GOOGLE-{google_id[:8]}"
        
        # Hardcoded default student password for new Google users (they won't use it anyway)
        from werkzeug.security import generate_password_hash
        hashed_pw = generate_password_hash("student123")
        
        cursor.execute(
            """INSERT INTO members (name, roll_no, email, google_id, username, password, role, status)
               VALUES (%s, %s, %s, %s, %s, %s, 'student', 'active') RETURNING member_id""",
            (name, roll_no, email, google_id, username, hashed_pw)
        )
        new_member = cursor.fetchone()
        conn.commit()
        
        if new_member:
            session['member_id'] = new_member['member_id']
            session['role'] = 'student'
            session['name'] = name
            conn.close()
            flash("Account successfully created with Google!", "success")
            return redirect(url_for('dashboard.index'))
            
        conn.close()
        flash("Could not create account.", "error")
        return redirect(url_for('auth.register'))
        
    except Exception as e:
        import traceback
        current_app.logger.error(f"Google OAuth Error: {e}\n{traceback.format_exc()}")
        flash("An error occurred during Google authentication.", "error")
        return redirect(url_for('auth.login'))
