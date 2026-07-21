"""
Billing routes — Receipt generation, billing summary, and transaction APIs.
"""

from flask import Blueprint, request, render_template, jsonify, session
from routes.auth import login_required, admin_required
from models import get_db
from datetime import date, timedelta
import config

billing_bp = Blueprint('billing', __name__)


@billing_bp.route('/billing')
@admin_required
def billing_page():
    """Render the admin Billing & Calculations page."""
    return render_template('billing.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('name'),
                           role=session.get('role'))


@billing_bp.route('/api/billing/receipt/<int:issue_id>')
@login_required
def api_get_receipt(issue_id):
    """Get receipt data for a single issue/return transaction."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT ir.*, b.title, b.author, b.isbn,
                  m.name as member_name, m.roll_no, m.department, m.year, m.contact
           FROM issue_records ir
           JOIN books b ON ir.book_id = b.book_id
           JOIN members m ON ir.member_id = m.member_id
           WHERE ir.issue_id = %s""",
        (issue_id,)
    )
    record = cursor.fetchone()
    conn.close()

    if not record:
        return jsonify({'error': 'Record not found'}), 404

    # Students can only view their own receipts
    if session.get('role') != 'admin' and record['member_id'] != session.get('member_id'):
        return jsonify({'error': 'Unauthorized'}), 403

    receipt = dict(record)

    # Convert dates to string
    for key in ['issue_date', 'due_date', 'return_date']:
        if receipt.get(key) and hasattr(receipt[key], 'strftime'):
            receipt[key] = receipt[key].strftime('%d %b %Y')

    # Fine calculation details
    if receipt.get('fine_amount'):
        receipt['fine_amount'] = float(receipt['fine_amount'])
    else:
        receipt['fine_amount'] = 0.0

    # Calculate days late for display
    if record.get('return_date') and record.get('due_date'):
        ret_date = record['return_date'] if isinstance(record['return_date'], date) else date.fromisoformat(str(record['return_date']))
        due_date = record['due_date'] if isinstance(record['due_date'], date) else date.fromisoformat(str(record['due_date']))
        if ret_date > due_date:
            receipt['days_late'] = (ret_date - due_date).days
        else:
            receipt['days_late'] = 0
    else:
        receipt['days_late'] = 0

    receipt['fine_per_day'] = config.FINE_PER_DAY
    receipt['max_fine'] = config.MAX_FINE
    receipt['loan_days'] = config.LOAN_DAYS
    receipt['college_name'] = 'Govt. Arts and Science College, Thally'
    receipt['system_name'] = config.APP_NAME

    # Determine receipt type
    if receipt['status'] == 'issued':
        receipt['receipt_type'] = 'BOOK ISSUE RECEIPT'
    elif receipt['status'] == 'returned' and receipt['fine_amount'] > 0:
        if receipt.get('fine_paid'):
            receipt['receipt_type'] = 'BOOK RETURN & FINE PAYMENT RECEIPT'
        else:
            receipt['receipt_type'] = 'BOOK RETURN RECEIPT'
    elif receipt['status'] == 'returned':
        receipt['receipt_type'] = 'BOOK RETURN RECEIPT'
    else:
        receipt['receipt_type'] = 'TRANSACTION RECEIPT'

    return jsonify(receipt)


@billing_bp.route('/api/billing/summary')
@admin_required
def api_billing_summary():
    """Get billing summary statistics."""
    conn = get_db()
    cursor = conn.cursor()
    today = date.today()

    cursor.execute("""
        SELECT
            COALESCE(SUM(CASE WHEN fine_paid = TRUE THEN fine_amount ELSE 0 END), 0) as total_fines_collected,
            COALESCE(SUM(CASE WHEN fine_paid = FALSE AND fine_amount > 0 THEN fine_amount ELSE 0 END), 0) as total_unpaid_fines,
            COUNT(CASE WHEN issue_date = %s THEN 1 END) as transactions_today,
            COUNT(CASE WHEN return_date = %s THEN 1 END) as returns_today,
            COUNT(CASE WHEN status = 'issued' THEN 1 END) as total_issued,
            COUNT(CASE WHEN status = 'returned' THEN 1 END) as total_returned,
            COUNT(*) as total_transactions,
            COUNT(CASE WHEN fine_amount > 0 AND fine_paid = TRUE THEN 1 END) as fines_paid_count,
            COUNT(CASE WHEN fine_amount > 0 AND fine_paid = FALSE THEN 1 END) as fines_unpaid_count,
            COUNT(CASE WHEN fine_amount > 0 THEN 1 END) as total_fine_records
        FROM issue_records
    """, (today, today))

    stats = cursor.fetchone()

    # Monthly revenue (fines collected per month for last 6 months)
    cursor.execute("""
        SELECT TO_CHAR(return_date, 'YYYY-MM') as month,
               COALESCE(SUM(fine_amount), 0) as amount
        FROM issue_records
        WHERE fine_paid = TRUE
          AND fine_amount > 0
          AND return_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY TO_CHAR(return_date, 'YYYY-MM')
        ORDER BY month
    """)
    monthly_revenue = [dict(row) for row in cursor.fetchall()]
    for mr in monthly_revenue:
        mr['amount'] = float(mr['amount'])

    conn.close()

    total_fines_collected = float(stats['total_fines_collected'] or 0)
    total_unpaid = float(stats['total_unpaid_fines'] or 0)
    total_fine_records = stats['total_fine_records'] or 0
    fines_paid_count = stats['fines_paid_count'] or 0

    return jsonify({
        'total_fines_collected': total_fines_collected,
        'total_unpaid_fines': total_unpaid,
        'transactions_today': stats['transactions_today'] or 0,
        'returns_today': stats['returns_today'] or 0,
        'total_issued': stats['total_issued'] or 0,
        'total_returned': stats['total_returned'] or 0,
        'total_transactions': stats['total_transactions'] or 0,
        'fine_collection_rate': round((fines_paid_count / total_fine_records * 100) if total_fine_records > 0 else 100, 1),
        'fines_paid_count': fines_paid_count,
        'fines_unpaid_count': stats['fines_unpaid_count'] or 0,
        'monthly_revenue': monthly_revenue,
        'fine_per_day': config.FINE_PER_DAY,
        'max_fine': config.MAX_FINE,
        'loan_days': config.LOAN_DAYS
    })


@billing_bp.route('/api/billing/transactions')
@admin_required
def api_billing_transactions():
    """Get all transactions with fine details, filterable by date and status."""
    status_filter = request.args.get('status', None)
    date_from = request.args.get('from', None)
    date_to = request.args.get('to', None)

    conn = get_db()
    cursor = conn.cursor()

    query = """
        SELECT ir.issue_id, ir.book_id, ir.member_id, ir.issue_date, ir.due_date,
               ir.return_date, ir.status, ir.fine_amount, ir.fine_paid,
               b.title, b.author, b.isbn,
               m.name as member_name, m.roll_no, m.department
        FROM issue_records ir
        JOIN books b ON ir.book_id = b.book_id
        JOIN members m ON ir.member_id = m.member_id
        WHERE 1=1
    """
    params = []

    if status_filter and status_filter != 'all':
        if status_filter == 'fines_unpaid':
            query += " AND ir.fine_amount > 0 AND ir.fine_paid = FALSE"
        elif status_filter == 'fines_paid':
            query += " AND ir.fine_amount > 0 AND ir.fine_paid = TRUE"
        else:
            query += " AND ir.status = %s"
            params.append(status_filter)

    if date_from:
        query += " AND ir.issue_date >= %s"
        params.append(date_from)

    if date_to:
        query += " AND ir.issue_date <= %s"
        params.append(date_to)

    query += " ORDER BY ir.issue_id DESC"

    cursor.execute(query, tuple(params))
    records = [dict(row) for row in cursor.fetchall()]
    conn.close()

    today = date.today()
    for r in records:
        for key in ['issue_date', 'due_date', 'return_date']:
            if r.get(key) and hasattr(r[key], 'strftime'):
                r[key] = r[key].strftime('%Y-%m-%d')
        if r.get('fine_amount'):
            r['fine_amount'] = float(r['fine_amount'])
        else:
            r['fine_amount'] = 0.0

        # Calculate days late
        if r.get('return_date') and r.get('due_date'):
            try:
                ret = date.fromisoformat(str(r['return_date']))
                due = date.fromisoformat(str(r['due_date']))
                r['days_late'] = max(0, (ret - due).days)
            except (ValueError, TypeError):
                r['days_late'] = 0
        elif r.get('status') == 'issued' and r.get('due_date'):
            try:
                due = date.fromisoformat(str(r['due_date']))
                if today > due:
                    r['days_late'] = (today - due).days
                    r['estimated_fine'] = min(r['days_late'] * config.FINE_PER_DAY, config.MAX_FINE)
                else:
                    r['days_late'] = 0
            except (ValueError, TypeError):
                r['days_late'] = 0
        else:
            r['days_late'] = 0

    return jsonify(records)
