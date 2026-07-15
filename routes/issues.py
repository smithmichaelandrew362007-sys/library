"""
Issue/Return routes — the core workflow APIs.
"""

from flask import Blueprint, request, render_template, jsonify, session
from routes.auth import login_required, admin_required
from models import issue as issue_model
import config

issues_bp = Blueprint('issues', __name__)


@issues_bp.route('/issue-return')
@admin_required
def issue_return_page():
    """Render issue/return page (admin only)."""
    return render_template('issue_return.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('name'),
                           role=session.get('role'))


@issues_bp.route('/my-books')
@login_required
def my_books_page():
    """Render student's borrowed books page."""
    return render_template('my_books.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('name'),
                           role=session.get('role'))


@issues_bp.route('/reports')
@admin_required
def reports_page():
    """Render reports page (admin only)."""
    return render_template('reports.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('name'),
                           role=session.get('role'))


# ─── Issue/Return APIs ───────────────────────────────────────

@issues_bp.route('/api/issues/issue', methods=['POST'])
@admin_required
def api_issue_book():
    """API: Issue a book to a member."""
    data = request.get_json()
    book_id = data.get('book_id')
    member_id = data.get('member_id')

    if not book_id or not member_id:
        return jsonify({'error': 'Book ID and Member ID are required'}), 400

    success, message, issue_id = issue_model.issue_book(book_id, member_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message, 'issue_id': issue_id})


@issues_bp.route('/api/issues/return', methods=['POST'])
@admin_required
def api_return_book():
    """API: Return a book."""
    data = request.get_json()
    issue_id = data.get('issue_id')

    if not issue_id:
        return jsonify({'error': 'Issue ID is required'}), 400

    success, message, fine = issue_model.return_book(issue_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message, 'fine_amount': fine})


# ==========================================
# Pre-booking / Reservations Routes
# ==========================================

@issues_bp.route('/api/issues/pre-book', methods=['POST'])
@login_required
def api_pre_book():
    """API: Student pre-books a book."""
    if session.get('role') != 'student':
        return jsonify({'error': 'Only students can pre-book books'}), 403

    data = request.get_json()
    book_id = data.get('book_id')
    if not book_id:
        return jsonify({'error': 'Book ID required'}), 400

    member_id = session['member_id']
    success, message = issue_model.pre_book_book(book_id, member_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message})


@issues_bp.route('/api/issues/reservations/<int:issue_id>/cancel', methods=['POST'])
@login_required
def api_cancel_reservation(issue_id):
    """API: Cancel a pre-booking (Admin or the student who booked it)."""
    user_id = session['member_id']
    role = session['role']
    success, message = issue_model.cancel_reservation(issue_id, user_id=user_id, role=role)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message})


@issues_bp.route('/api/issues/reservations/<int:issue_id>/fulfill', methods=['POST'])
@login_required
def api_fulfill_reservation(issue_id):
    """API: Fulfill a reservation (Admin hands over the book)."""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    success, message = issue_model.fulfill_reservation(issue_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message})


@issues_bp.route('/api/issues/reservations', methods=['GET'])
@login_required
def api_get_all_reservations():
    """API: Get all pending reservations (Admin only)."""
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(issue_model.get_all_reservations())


@issues_bp.route('/api/issues/my-reservations', methods=['GET'])
@login_required
def api_my_reservations():
    """API: Get current student's pending reservations."""
    if session.get('role') != 'student':
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(issue_model.get_student_reservations(session['member_id']))


@issues_bp.route('/api/issues/pay-fine', methods=['POST'])
@admin_required
def api_pay_fine():
    """API: Mark a fine as paid."""
    data = request.get_json()
    issue_id = data.get('issue_id')
    if not issue_id:
        return jsonify({'error': 'Issue ID is required'}), 400

    success, message = issue_model.pay_fine(issue_id)
    return jsonify({'success': True, 'message': message})


# ─── Query APIs ───────────────────────────────────────────────

@issues_bp.route('/api/issues/issued', methods=['GET'])
@login_required
def api_get_issued():
    """API: Get currently issued books."""
    member_id = request.args.get('member_id', type=int)
    # Students can only see their own
    if session.get('role') != 'admin':
        member_id = session.get('member_id')

    issues = issue_model.get_issued_books(member_id)
    for i in issues:
        for key in ['issue_date', 'due_date', 'return_date']:
            if i.get(key) and hasattr(i[key], 'strftime'):
                i[key] = i[key].strftime('%Y-%m-%d')
    return jsonify(issues)


@issues_bp.route('/api/issues/overdue', methods=['GET'])
@admin_required
def api_get_overdue():
    """API: Get all overdue books."""
    overdue = issue_model.get_overdue_books()
    for i in overdue:
        for key in ['issue_date', 'due_date', 'return_date']:
            if i.get(key) and hasattr(i[key], 'strftime'):
                i[key] = i[key].strftime('%Y-%m-%d')
    return jsonify(overdue)


@issues_bp.route('/api/issues/today', methods=['GET'])
@admin_required
def api_get_today():
    """API: Get books issued today."""
    issues = issue_model.get_issued_today()
    for i in issues:
        for key in ['issue_date', 'due_date', 'return_date']:
            if i.get(key) and hasattr(i[key], 'strftime'):
                i[key] = i[key].strftime('%Y-%m-%d')
    return jsonify(issues)


@issues_bp.route('/api/issues/all', methods=['GET'])
@admin_required
def api_get_all_records():
    """API: Get all issue records."""
    status = request.args.get('status', None)
    records = issue_model.get_all_records(status)
    for r in records:
        for key in ['issue_date', 'due_date', 'return_date']:
            if r.get(key) and hasattr(r[key], 'strftime'):
                r[key] = r[key].strftime('%Y-%m-%d')
        if r.get('fine_amount'):
            r['fine_amount'] = float(r['fine_amount'])
    return jsonify(records)


@issues_bp.route('/api/issues/unpaid-fines', methods=['GET'])
@login_required
def api_get_unpaid_fines():
    """API: Get unpaid fines."""
    member_id = request.args.get('member_id', type=int)
    if session.get('role') != 'admin':
        member_id = session.get('member_id')

    fines = issue_model.get_unpaid_fines(member_id)
    for f in fines:
        for key in ['issue_date', 'due_date', 'return_date']:
            if f.get(key) and hasattr(f[key], 'strftime'):
                f[key] = f[key].strftime('%Y-%m-%d')
        if f.get('fine_amount'):
            f['fine_amount'] = float(f['fine_amount'])
    return jsonify(fines)
