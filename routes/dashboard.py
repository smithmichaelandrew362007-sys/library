"""
Dashboard routes — stats and reports APIs.
"""

from flask import Blueprint, render_template, jsonify, session
from routes.auth import login_required, admin_required
from models import issue as issue_model
import config

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/')
@login_required
def index():
    """Root redirect based on role."""
    if session.get('role') == 'admin':
        return render_template('dashboard.html',
                               app_name=config.APP_NAME,
                               user_name=session.get('user_name'),
                               role=session.get('role'))
    return render_template('my_books.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('user_name'),
                           role=session.get('role'))


@dashboard_bp.route('/dashboard')
@admin_required
def dashboard_page():
    """Render admin dashboard page."""
    return render_template('dashboard.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('user_name'),
                           role=session.get('role'))


@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
@admin_required
def api_dashboard_stats():
    """API: Get dashboard statistics."""
    stats = issue_model.get_dashboard_stats()

    # Convert dates in recent activity
    for r in stats.get('recent_activity', []):
        for key in ['issue_date', 'due_date', 'return_date']:
            if r.get(key) and hasattr(r[key], 'strftime'):
                r[key] = r[key].strftime('%Y-%m-%d')
        if r.get('fine_amount'):
            r['fine_amount'] = float(r['fine_amount'])
            
    # Convert dates in recent members
    for m in stats.get('recent_members', []):
        if m.get('created_at') and hasattr(m['created_at'], 'strftime'):
            m['created_at'] = m['created_at'].strftime('%Y-%m-%d %H:%M')

    return jsonify(stats)
