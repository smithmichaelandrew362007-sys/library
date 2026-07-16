"""
Member model — CRUD operations for the Members table.
"""

from models import get_db
from werkzeug.security import generate_password_hash, check_password_hash


def get_all_members(role=None):
    """Retrieve all members, optionally filtered by role."""
    conn = get_db()
    cursor = conn.cursor()
    if role:
        cursor.execute("SELECT * FROM members WHERE role = %s ORDER BY name", (role,))
    else:
        cursor.execute("SELECT * FROM members ORDER BY name")
    members = cursor.fetchall()
    conn.close()
    # Remove password from results
    for m in members:
        if isinstance(m, dict):
            m.pop('password', None)
    return members


def get_member(member_id):
    """Get a single member by ID."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM members WHERE member_id = %s", (member_id,))
    member = cursor.fetchone()
    conn.close()
    if member and isinstance(member, dict):
        member.pop('password', None)
    return member


def get_member_by_roll_no(roll_no):
    """Find a member by their roll number."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM members WHERE roll_no = %s", (roll_no,))
    member = cursor.fetchone()
    conn.close()
    if member and isinstance(member, dict):
        member.pop('password', None)
    return member


def search_members(query):
    """Search members by name, roll_no, or email."""
    conn = get_db()
    cursor = conn.cursor()
    like_query = f"%{query}%"
    cursor.execute(
        """SELECT * FROM members
           WHERE name LIKE %s OR roll_no LIKE %s OR username LIKE %s OR department LIKE %s
           ORDER BY name""",
        (like_query, like_query, like_query, like_query)
    )
    members = cursor.fetchall()
    conn.close()
    for m in members:
        if isinstance(m, dict):
            m.pop('password', None)
    return members


def authenticate(username, password, role='admin'):
    """Authenticate a user. Students do not require a password."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM members WHERE username = %s AND status = 'active'", (username,))
    member = cursor.fetchone()
    conn.close()

    if member:
        # If logging in as student and member is actually a student, skip password check
        if role == 'student' and member['role'] == 'student':
            if isinstance(member, dict):
                member.pop('password', None)
            return member
        # Otherwise, check password
        elif check_password_hash(member['password'], password):
            if isinstance(member, dict):
                member.pop('password', None)
            return member
    return None


def register_member(data):
    """Register a new member with hashed password."""
    conn = get_db()
    cursor = conn.cursor()
    hashed_pw = generate_password_hash(data.get('password', 'student123'))
    try:
        cursor.execute(
            """INSERT INTO members (name, roll_no, department, year, contact, email, username, password, role, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'active') RETURNING member_id""",
            (data['name'], data['roll_no'], data.get('department', ''),
             data.get('year', ''), data.get('contact', ''), data.get('email', ''),
             data['username'], hashed_pw, data.get('role', 'student'))
        )
        result = cursor.fetchone()
        member_id = result['member_id'] if result else None
        conn.commit()
        conn.close()
        return member_id, None
    except Exception as e:
        conn.close()
        if 'UNIQUE' in str(e).upper():
            return None, "Roll number or username already exists"
        return None, str(e)


def update_member(member_id, data):
    """Update member details (excluding password)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """UPDATE members SET name=%s, roll_no=%s, department=%s,
           year=%s, contact=%s, email=%s, username=%s
           WHERE member_id=%s""",
        (data['name'], data['roll_no'], data.get('department', ''),
         data.get('year', ''), data.get('contact', ''), data.get('email', ''),
         data['username'], member_id)
    )
    conn.commit()
    conn.close()


def deactivate_member(member_id):
    """Deactivate a member (soft delete)."""
    conn = get_db()
    cursor = conn.cursor()
    # Check for active issues
    cursor.execute("SELECT COUNT(*) as count FROM issue_records WHERE member_id = %s AND status = 'issued'", (member_id,))
    row = cursor.fetchone()
    count = row['count'] if hasattr(row, 'keys') else row[0]
    if count > 0:
        conn.close()
        return False, "Cannot deactivate: member has active book issues"
    cursor.execute("UPDATE members SET status = 'inactive' WHERE member_id = %s", (member_id,))
    conn.commit()
    conn.close()
    return True, "Member deactivated"


def activate_member(member_id):
    """Reactivate a member."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE members SET status = 'active' WHERE member_id = %s", (member_id,))
    conn.commit()
    conn.close()


def get_borrowing_history(member_id):
    """Get a member's complete borrowing history."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT ir.*, b.title, b.author, b.isbn
           FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           WHERE ir.member_id = %s
           ORDER BY ir.issue_date DESC""",
        (member_id,)
    )
    history = cursor.fetchall()
    conn.close()
    return history


def get_profile_stats(member_id):
    """Get stats for student profile."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Books read this month
    cursor.execute("""
        SELECT COUNT(*) as count 
        FROM issue_records 
        WHERE member_id = %s 
        AND status = 'returned' 
        AND TO_CHAR(return_date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    """, (member_id,))
    month_count = cursor.fetchone()['count']
    
    # Books read this year
    cursor.execute("""
        SELECT COUNT(*) as count 
        FROM issue_records 
        WHERE member_id = %s 
        AND status = 'returned' 
        AND TO_CHAR(return_date, 'YYYY') = TO_CHAR(CURRENT_DATE, 'YYYY')
    """, (member_id,))
    year_count = cursor.fetchone()['count']
    
    # Overall books read
    cursor.execute("""
        SELECT COUNT(*) as count 
        FROM issue_records 
        WHERE member_id = %s 
        AND status = 'returned'
    """, (member_id,))
    overall_count = cursor.fetchone()['count']
    
    # Total dues
    cursor.execute("""
        SELECT COALESCE(SUM(fine_amount), 0) as total_fines 
        FROM issue_records 
        WHERE member_id = %s 
        AND fine_paid = FALSE 
        AND fine_amount > 0
    """, (member_id,))
    total_dues = cursor.fetchone()['total_fines']

    conn.close()
    return {
        'month_reads': month_count,
        'year_reads': year_count,
        'overall_reads': overall_count,
        'total_dues': float(total_dues)
    }


def delete_member(member_id):
    """Permanently delete a member and all their data."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM members WHERE member_id = %s", (member_id,))
    conn.commit()
    conn.close()
    return True, "Student permanently deleted"
