from flask import Blueprint, render_template, request, redirect, url_for, flash, session, jsonify
from models.member import authenticate, get_db, register_member
from functools import wraps

auth_bp = Blueprint('auth', __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'member_id' not in session:
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'member_id' not in session or session.get('role') != 'admin':
            flash('Administrator access required.', 'danger')
            return redirect(url_for('auth.login'))
        return f(*args, **kwargs)
    return decorated_function


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        role = request.form.get('role', 'student')
        
        if role == 'admin':
            username = request.form.get('username')
            password = request.form.get('password')
            member = authenticate(username, password, role='admin')
            if member:
                session['member_id'] = member['member_id']
                session['role'] = member['role']
                session['name'] = member['name']
                flash('Login successful!', 'success')
                return redirect(url_for('dashboard.index'))
            else:
                flash('Invalid admin credentials.', 'danger')
        else:
            # Student login
            mobile = request.form.get('mobile')
            username = request.form.get('username')
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM members WHERE username = %s AND contact = %s AND role = 'student' AND status = 'active'", (username, mobile))
            member = cursor.fetchone()
            conn.close()

            if member:
                session['member_id'] = member['member_id']
                session['role'] = member['role']
                session['name'] = member['name']
                flash('Login successful!', 'success')
                return redirect(url_for('dashboard.index'))
            else:
                flash('Invalid mobile number or username.', 'danger')

    return render_template('login.html')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = {
            'name': request.form.get('name'),
            'roll_no': request.form.get('roll_no'),
            'username': request.form.get('username'),
            'department': request.form.get('department'),
            'year': request.form.get('year'),
            'contact': request.form.get('contact'),
            'email': request.form.get('email', ''),
            'role': 'student'
        }
        
        if not data['name'] or not data['roll_no'] or not data['username'] or not data['contact']:
            flash('Please fill in all required fields.', 'danger')
            return render_template('register.html')
            
        member_id, error = register_member(data)
        
        if error:
            flash(error, 'danger')
        else:
            flash('Account created successfully! You can now log in.', 'success')
            return redirect(url_for('auth.login'))
            
    return render_template('register.html')

@auth_bp.route('/admin-register', methods=['GET', 'POST'])
def admin_register():
    if request.method == 'POST':
        import random
        # Admins don't typically have a student roll_no, generate a unique one
        unique_roll = f"ADM{random.randint(1000, 9999)}"
        
        data = {
            'name': request.form.get('name'),
            'roll_no': unique_roll,
            'username': request.form.get('username'),
            'department': request.form.get('department'),
            'year': request.form.get('year'),
            'contact': request.form.get('contact'),
            'password': request.form.get('password'),
            'role': 'admin'
        }
        
        if not data['name'] or not data['username'] or not data['password'] or not data['contact']:
            flash('Please fill in all required fields.', 'danger')
            return render_template('admin_register.html')
            
        member_id, error = register_member(data)
        
        if error:
            flash(error, 'danger')
        else:
            flash('Admin account created successfully! You can now log in.', 'success')
            return redirect(url_for('auth.login'))
            
    return render_template('admin_register.html')
@auth_bp.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))

@auth_bp.route('/check_mobile', methods=['POST'])
def check_mobile():
    data = request.get_json()
    mobile = data.get('mobile')
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT username FROM members WHERE contact = %s AND role = 'student' AND status = 'active'", (mobile,))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        return jsonify({"success": True, "username": user['username']})
    else:
        return jsonify({"success": False, "message": "Mobile number not found"})
