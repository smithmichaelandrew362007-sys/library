"""
Issue model — Issue/return book workflow and fine management.
This is the heart of the library system.
"""

from datetime import date, timedelta
from models import get_db
import config


def issue_book(book_id, member_id):
    """
    Issue a book to a member.
    Validates: availability, max books limit, unpaid fines.
    Returns: (success: bool, message: str, issue_id: int|None)
    """
    conn = get_db()
    cursor = conn.cursor()

    # 1. Check book availability
    cursor.execute("SELECT available_copies, title FROM books WHERE book_id = %s", (book_id,))
    book = cursor.fetchone()
    if not book:
        conn.close()
        return False, "Book not found", None
    if book['available_copies'] <= 0:
        conn.close()
        return False, f"'{book['title']}' is not available (0 copies left)", None

    # 2. Check member's current issued count
    cursor.execute(
        "SELECT COUNT(*) as count FROM issue_records WHERE member_id = %s AND status = 'issued'",
        (member_id,)
    )
    result = cursor.fetchone()
    if result['count'] >= config.MAX_BOOKS_PER_MEMBER:
        conn.close()
        return False, f"Student already has {config.MAX_BOOKS_PER_MEMBER} books issued (max limit)", None

    # 3. Check for unpaid fines
    cursor.execute(
        "SELECT SUM(fine_amount) as total_fines FROM issue_records WHERE member_id = %s AND fine_amount > 0 AND fine_paid = FALSE",
        (member_id,)
    )
    fines = cursor.fetchone()
    if fines['total_fines'] and float(fines['total_fines']) > 0:
        conn.close()
        return False, f"Student has unpaid fines of ₹{fines['total_fines']:.2f}", None

    # 4. Check if the same book is already issued to this member
    cursor.execute(
        "SELECT COUNT(*) as count FROM issue_records WHERE book_id = %s AND member_id = %s AND status = 'issued'",
        (book_id, member_id)
    )
    dup = cursor.fetchone()
    if dup['count'] > 0:
        conn.close()
        return False, "This book is already issued to this student", None

    # 5. All checks passed — issue the book
    today = date.today()
    due = today + timedelta(days=config.LOAN_DAYS)

    cursor.execute(
        """INSERT INTO issue_records (book_id, member_id, issue_date, due_date, status)
           VALUES (%s, %s, %s, %s, 'issued') RETURNING issue_id""",
        (book_id, member_id, today, due)
    )
    result = cursor.fetchone()
    issue_id = result['issue_id'] if result else None

    # 6. Decrease available copies
    cursor.execute(
        "UPDATE books SET available_copies = available_copies - 1 WHERE book_id = %s",
        (book_id,)
    )

    conn.commit()
    conn.close()
    return True, f"Book issued successfully. Due date: {due.strftime('%d %b %Y')}", issue_id


def return_book(issue_id):
    """
    Return a book. Calculates fine if overdue.
    Returns: (success: bool, message: str, fine_amount: float)
    """
    conn = get_db()
    cursor = conn.cursor()

    # Get the issue record
    cursor.execute(
        """SELECT ir.*, b.title FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           WHERE ir.issue_id = %s AND ir.status = 'issued'""",
        (issue_id,)
    )
    issue = cursor.fetchone()
    if not issue:
        conn.close()
        return False, "Issue record not found or already returned", 0

    # Calculate fine
    today = date.today()
    # Need to parse due_date from SQLite which stores dates as strings usually 'YYYY-MM-DD'
    if isinstance(issue['due_date'], str):
        due_date = date.fromisoformat(issue['due_date'])
    else:
        due_date = issue['due_date']
        
    fine_amount = 0.0
    if today > due_date:
        days_late = (today - due_date).days
        fine_amount = min(days_late * config.FINE_PER_DAY, config.MAX_FINE)

    # Update issue record
    cursor.execute(
        """UPDATE issue_records SET return_date = %s, fine_amount = %s,
           fine_paid = %s, status = 'returned'
           WHERE issue_id = %s""",
        (today, fine_amount, fine_amount == 0, issue_id)
    )

    # Increase available copies back
    cursor.execute(
        "UPDATE books SET available_copies = available_copies + 1 WHERE book_id = %s",
        (issue['book_id'],)
    )

    conn.commit()
    conn.close()

    if fine_amount > 0:
        return True, f"Book '{issue['title']}' returned. Late fine: ₹{fine_amount:.2f}", fine_amount
    return True, f"Book '{issue['title']}' returned successfully. No fine.", 0


def pay_fine(issue_id):
    """Mark a fine as paid."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE issue_records SET fine_paid = TRUE WHERE issue_id = %s",
        (issue_id,)
    )
    conn.commit()
    conn.close()
    return True, "Fine paid successfully"


def get_issued_books(member_id=None):
    """Get currently issued books, optionally filtered by member."""
    conn = get_db()
    cursor = conn.cursor()
    if member_id:
        cursor.execute(
            """SELECT ir.*, b.title, b.author, b.isbn, m.name as member_name, m.roll_no
               FROM issue_records ir
               JOIN books b ON ir.book_id = b.book_id
               JOIN members m ON ir.member_id = m.member_id
               WHERE ir.member_id = %s AND ir.status = 'issued'
               ORDER BY ir.due_date ASC""",
            (member_id,)
        )
    else:
        cursor.execute(
            """SELECT ir.*, b.title, b.author, b.isbn, m.name as member_name, m.roll_no
               FROM issue_records ir
               JOIN books b ON ir.book_id = b.book_id
               JOIN members m ON ir.member_id = m.member_id
               WHERE ir.status = 'issued'
               ORDER BY ir.due_date ASC"""
        )
    issues = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Add overdue status to each record
    today = date.today()
    for issue in issues:
        due_date = date.fromisoformat(issue['due_date']) if isinstance(issue['due_date'], str) else issue['due_date']
        if due_date < today:
            issue['is_overdue'] = True
            days_late = (today - due_date).days
            issue['days_late'] = days_late
            issue['estimated_fine'] = min(days_late * config.FINE_PER_DAY, config.MAX_FINE)
        else:
            issue['is_overdue'] = False
            issue['days_remaining'] = (due_date - today).days
            issue['estimated_fine'] = 0

    return issues


def get_overdue_books():
    """Get all overdue books (due_date < today and not returned)."""
    conn = get_db()
    cursor = conn.cursor()
    today = date.today()
    cursor.execute(
        """SELECT ir.*, b.title, b.author, m.name as member_name, m.roll_no, m.username, m.contact
           FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           JOIN members m ON ir.member_id = m.member_id
           WHERE ir.status = 'issued' AND ir.due_date < %s
           ORDER BY ir.due_date ASC""",
        (today,)
    )
    overdue = [dict(row) for row in cursor.fetchall()]
    conn.close()

    for item in overdue:
        due_date = date.fromisoformat(item['due_date']) if isinstance(item['due_date'], str) else item['due_date']
        days_late = (today - due_date).days
        item['days_late'] = days_late
        item['estimated_fine'] = min(days_late * config.FINE_PER_DAY, config.MAX_FINE)

    return overdue


def get_issued_today():
    """Get count and list of books issued today."""
    conn = get_db()
    cursor = conn.cursor()
    today = date.today()
    cursor.execute(
        """SELECT ir.*, b.title, b.author, m.name as member_name, m.roll_no
           FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           JOIN members m ON ir.member_id = m.member_id
           WHERE ir.issue_date = %s
           ORDER BY ir.issue_id DESC""",
        (today,)
    )
    issues = cursor.fetchall()
    conn.close()
    return issues


def get_all_records(status=None):
    """Get all issue records, optionally filtered by status."""
    conn = get_db()
    cursor = conn.cursor()
    if status:
        cursor.execute(
            """SELECT ir.*, b.title, b.author, m.name as member_name, m.roll_no
               FROM issue_records ir
               JOIN books b ON ir.book_id = b.book_id
               JOIN members m ON ir.member_id = m.member_id
               WHERE ir.status = %s
               ORDER BY ir.issue_id DESC""",
            (status,)
        )
    else:
        cursor.execute(
            """SELECT ir.*, b.title, b.author, m.name as member_name, m.roll_no
               FROM issue_records ir
               JOIN books b ON ir.book_id = b.book_id
               JOIN members m ON ir.member_id = m.member_id
               ORDER BY ir.issue_id DESC"""
        )
    records = cursor.fetchall()
    conn.close()
    return records


def get_unpaid_fines(member_id=None):
    """Get all unpaid fines, optionally filtered by member."""
    conn = get_db()
    cursor = conn.cursor()
    if member_id:
        cursor.execute(
            """SELECT ir.*, b.title, m.name as member_name, m.roll_no
               FROM issue_records ir
               JOIN books b ON ir.book_id = b.book_id
               JOIN members m ON ir.member_id = m.member_id
               WHERE ir.fine_amount > 0 AND ir.fine_paid = FALSE AND ir.member_id = %s
               ORDER BY ir.return_date DESC""",
            (member_id,)
        )
    else:
        cursor.execute(
            """SELECT ir.*, b.title, m.name as member_name, m.roll_no
               FROM issue_records ir
               JOIN books b ON ir.book_id = b.book_id
               JOIN members m ON ir.member_id = m.member_id
               WHERE ir.fine_amount > 0 AND ir.fine_paid = FALSE
               ORDER BY ir.return_date DESC"""
        )
    fines = cursor.fetchall()
    conn.close()
    return fines


def get_dashboard_stats():
    """Get summary statistics for the admin dashboard."""
    conn = get_db()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("""
        SELECT 
            (SELECT COUNT(*) FROM books) as total_books,
            (SELECT COALESCE(SUM(total_copies), 0) FROM books) as total_copies,
            (SELECT COUNT(*) FROM members WHERE role = 'student' AND status = 'active') as total_members,
            (SELECT COUNT(*) FROM issue_records WHERE status = 'issued') as currently_issued,
            (SELECT COUNT(*) FROM issue_records WHERE status = 'issued' AND due_date < %s) as overdue_count,
            (SELECT COUNT(*) FROM issue_records WHERE issue_date = %s) as issued_today,
            (SELECT COALESCE(SUM(fine_amount), 0) FROM issue_records WHERE fine_paid = FALSE AND fine_amount > 0) as total_unpaid_fines
    """, (today, today))
    batch_stats = cursor.fetchone()

    # Books issued per month (last 6 months)
    cursor.execute(
        """SELECT TO_CHAR(issue_date, 'YYYY-MM') as month,
                  COUNT(*) as count
           FROM issue_records
           WHERE issue_date >= CURRENT_DATE - INTERVAL '6 months'
           GROUP BY TO_CHAR(issue_date, 'YYYY-MM')
           ORDER BY month"""
    )
    monthly_stats = cursor.fetchall()

    # Books by category
    cursor.execute(
        """SELECT category, COUNT(*) as count
           FROM books
           GROUP BY category
           ORDER BY count DESC"""
    )
    category_stats = cursor.fetchall()

    # Recent activity (last 10)
    cursor.execute(
        """SELECT ir.*, b.title, m.name as member_name, m.roll_no
           FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           JOIN members m ON ir.member_id = m.member_id
           ORDER BY ir.issue_id DESC
           LIMIT 10"""
    )
    recent_activity = cursor.fetchall()

    # Recent members (last 5 added)
    cursor.execute(
        """SELECT member_id, name, roll_no, created_at
           FROM members
           WHERE role = 'student'
           ORDER BY member_id DESC
           LIMIT 5"""
    )
    recent_members = [dict(row) for row in cursor.fetchall()]

    conn.close()

    return {
        'total_books': batch_stats['total_books'],
        'total_copies': int(batch_stats['total_copies'] or 0),
        'total_members': batch_stats['total_members'],
        'currently_issued': batch_stats['currently_issued'],
        'overdue_count': batch_stats['overdue_count'],
        'issued_today': batch_stats['issued_today'],
        'monthly_stats': monthly_stats,
        'category_stats': category_stats,
        'recent_activity': recent_activity,
        'total_unpaid_fines': float(batch_stats['total_unpaid_fines'] or 0),
        'recent_members': recent_members
    }


# ==========================================
# Pre-booking / Reservations 
# ==========================================

def pre_book_book(book_id, member_id):
    """
    Atomically pre-book a book for a member using SQLite EXCLUSIVE TRANSACTION.
    Ensures that concurrency limits are respected without race conditions.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Check if member already issued or pre-booked this book
        cursor.execute(
            "SELECT COUNT(*) as count FROM issue_records WHERE book_id = %s AND member_id = %s AND status IN ('issued', 'reserved')",
            (book_id, member_id)
        )
        if cursor.fetchone()['count'] > 0:
            conn.rollback()
            return False, "You already have this book issued or pre-booked."

        # Check total limits
        cursor.execute(
            "SELECT COUNT(*) as count FROM issue_records WHERE member_id = %s AND status IN ('issued', 'reserved')",
            (member_id,)
        )
        if cursor.fetchone()['count'] >= config.MAX_BOOKS_PER_MEMBER:
            conn.rollback()
            return False, f"You have reached the maximum limit of {config.MAX_BOOKS_PER_MEMBER} active items."

        # Atomically check and decrement available copies
        cursor.execute(
            "UPDATE books SET available_copies = available_copies - 1 WHERE book_id = %s AND available_copies > 0",
            (book_id,)
        )
        if cursor.rowcount == 0:
            conn.rollback()
            return False, "Sorry, this book is currently out of stock."

        issue_date = date.today().isoformat()
        # Due date for collecting a pre-booked item is 2 days from now
        due_date = (date.today() + timedelta(days=2)).isoformat()
        
        cursor.execute(
            """INSERT INTO issue_records (book_id, member_id, issue_date, due_date, status) 
               VALUES (%s, %s, %s, %s, 'reserved')""",
            (book_id, member_id, issue_date, due_date)
        )
        conn.commit()
        return True, "Book successfully pre-booked! Please collect it within 2 days."
    except Exception as e:
        conn.rollback()
        return False, f"System error: {str(e)}"
    finally:
        conn.close()


def cancel_reservation(issue_id, user_id=None, role=None):
    """Cancel a pre-booking and return the copy to available_copies."""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM issue_records WHERE issue_id = %s AND status = 'reserved'", (issue_id,))
        record = cursor.fetchone()
        
        if not record:
            conn.rollback()
            return False, "Reservation not found or already processed."
            
        if role == 'student' and record['member_id'] != user_id:
            conn.rollback()
            return False, "Unauthorized to cancel this reservation."

        # Return the copy to stock
        cursor.execute("UPDATE books SET available_copies = available_copies + 1 WHERE book_id = %s", (record['book_id'],))
        # Delete the reservation record
        cursor.execute("DELETE FROM issue_records WHERE issue_id = %s", (issue_id,))
        
        conn.commit()
        return True, "Reservation cancelled successfully."
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()


def fulfill_reservation(issue_id):
    """Convert a reserved item into an issued item (Admin hands over the book)."""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM issue_records WHERE issue_id = %s AND status = 'reserved'", (issue_id,))
        if not cursor.fetchone():
            conn.rollback()
            return False, "Reservation not found."
            
        issue_date = date.today().isoformat()
        due_date = (date.today() + timedelta(days=config.LOAN_DAYS)).isoformat()
        
        cursor.execute(
            "UPDATE issue_records SET status = 'issued', issue_date = %s, due_date = %s WHERE issue_id = %s",
            (issue_date, due_date, issue_id)
        )
        conn.commit()
        return True, "Book handed over successfully!"
    except Exception as e:
        conn.rollback()
        return False, str(e)
    finally:
        conn.close()


def get_all_reservations():
    """Get all pending reservations for admin."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT ir.*, b.title as book_title, b.isbn, m.name as member_name, m.roll_no 
           FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           JOIN members m ON ir.member_id = m.member_id
           WHERE ir.status = 'reserved'
           ORDER BY ir.issue_id DESC"""
    )
    res = cursor.fetchall()
    conn.close()
    return res


def get_student_reservations(member_id):
    """Get pending reservations for a specific student."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT ir.*, b.title as book_title, b.author
           FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           WHERE ir.member_id = %s AND ir.status = 'reserved'
           ORDER BY ir.issue_id DESC""",
        (member_id,)
    )
    res = cursor.fetchall()
    conn.close()
    return res
