"""
Member management routes — CRUD and search APIs.
"""

from flask import Blueprint, request, render_template, jsonify, session
from routes.auth import login_required, admin_required
from models import member as member_model
from models import message as message_model
import config

members_bp = Blueprint('members', __name__)


@members_bp.route('/members')
@admin_required
def members_page():
    """Render member management page (admin only)."""
    return render_template('members.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('user_name'),
                           role=session.get('role'))


@members_bp.route('/api/members', methods=['GET'])
@admin_required
def api_get_members():
    """API: Get all members or search."""
    query = request.args.get('q', '').strip()
    role_filter = request.args.get('role', None)

    if query:
        members = member_model.search_members(query)
    else:
        members = member_model.get_all_members(role_filter)

    # Filter out admins
    members = [m for m in members if m.get('role') != 'admin']

    # Convert datetime to string
    for m in members:
        if m.get('created_at') and hasattr(m['created_at'], 'strftime'):
            m['created_at'] = m['created_at'].strftime('%Y-%m-%d %H:%M:%S')

    return jsonify(members)


@members_bp.route('/api/members/<int:member_id>', methods=['GET'])
@login_required
def api_get_member(member_id):
    """API: Get a single member."""
    # Students can only view their own profile
    if session.get('role') != 'admin' and session.get('user_id') != member_id:
        return jsonify({'error': 'Access denied'}), 403

    m = member_model.get_member(member_id)
    if not m:
        return jsonify({'error': 'Student not found'}), 404
    if m.get('created_at') and hasattr(m['created_at'], 'strftime'):
        m['created_at'] = m['created_at'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(m)


@members_bp.route('/api/members/search-roll', methods=['GET'])
@admin_required
def api_search_by_roll():
    """API: Search member by roll number (for issue workflow)."""
    roll_no = request.args.get('roll_no', '').strip()
    if not roll_no:
        return jsonify({'error': 'Roll number is required'}), 400
    m = member_model.get_member_by_roll_no(roll_no)
    if not m:
        return jsonify({'error': 'Student not found'}), 404
    if m.get('created_at') and hasattr(m['created_at'], 'strftime'):
        m['created_at'] = m['created_at'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify(m)


@members_bp.route('/api/members', methods=['POST'])
@admin_required
def api_register_member():
    """API: Register a new member (admin only)."""
    data = request.get_json()
    if not data.get('name') or not data.get('roll_no') or not data.get('username'):
        return jsonify({'error': 'Name, roll number, and username are required'}), 400

    member_id, error = member_model.register_member(data)
    if error:
        return jsonify({'error': error}), 400
    return jsonify({'success': True, 'member_id': member_id, 'message': 'Student registered successfully'})


@members_bp.route('/api/members/<int:member_id>', methods=['PUT'])
@admin_required
def api_update_member(member_id):
    """API: Update a member (admin only)."""
    data = request.get_json()
    if not data.get('name') or not data.get('roll_no') or not data.get('username'):
        return jsonify({'error': 'Name, roll number, and username are required'}), 400
    member_model.update_member(member_id, data)
    return jsonify({'success': True, 'message': 'Student updated successfully'})


@members_bp.route('/api/members/<int:member_id>/deactivate', methods=['POST'])
@admin_required
def api_deactivate_member(member_id):
    """API: Deactivate a member (admin only)."""
    success, message = member_model.deactivate_member(member_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message})


@members_bp.route('/api/members/<int:member_id>/activate', methods=['POST'])
@admin_required
def api_activate_member(member_id):
    """API: Activate a member (admin only)."""
    member_model.activate_member(member_id)
    return jsonify({'success': True, 'message': 'Student activated'})


@members_bp.route('/api/members/<int:member_id>/history', methods=['GET'])
@login_required
def api_borrowing_history(member_id):
    """API: Get a member's borrowing history."""
    if session.get('role') != 'admin' and session.get('user_id') != member_id:
        return jsonify({'error': 'Access denied'}), 403

    history = member_model.get_borrowing_history(member_id)
    for h in history:
        for key in ['issue_date', 'due_date', 'return_date']:
            if h.get(key) and hasattr(h[key], 'strftime'):
                h[key] = h[key].strftime('%Y-%m-%d')
    return jsonify(history)

@members_bp.route('/profile')
@login_required
def my_profile_page():
    """Render the student profile page."""
    if session.get('role') == 'admin':
        return render_template('dashboard.html',
                               app_name=config.APP_NAME,
                               user_name=session.get('user_name'),
                               role=session.get('role'))
    return render_template('my_profile.html',
                           app_name=config.APP_NAME,
                           user_name=session.get('user_name'),
                           role=session.get('role'))

@members_bp.route('/api/profile/stats', methods=['GET'])
@login_required
def api_profile_stats():
    """Get profile stats and messages for the logged-in student."""
    member_id = session.get('user_id')
    stats = member_model.get_profile_stats(member_id)
    messages = message_model.get_messages(member_id)
    
    return jsonify({
        'stats': stats,
        'messages': messages
    })

@members_bp.route('/api/messages/send', methods=['POST'])
@admin_required
def api_send_message():
    """Admin sends a due reminder or message to a student."""
    data = request.get_json()
    member_id = data.get('member_id')
    message_text = data.get('message')
    
    if not member_id or not message_text:
        return jsonify({'error': 'Member ID and message text are required'}), 400
        
    sender_id = session.get('user_id')
    message_model.send_message(member_id, sender_id, message_text)
    
    return jsonify({'success': True, 'message': 'Message sent successfully'})

@members_bp.route('/api/messages/<int:message_id>/read', methods=['POST'])
@login_required
def api_mark_message_read(message_id):
    """Mark a message as read."""
    member_id = session.get('user_id')
    message_model.mark_as_read(message_id, member_id)
    return jsonify({'success': True})

@members_bp.route('/api/members/<int:member_id>', methods=['DELETE'])
@admin_required
def api_delete_member(member_id):
    """API: Permanently delete a member (admin only)."""
    success, message = member_model.delete_member(member_id)
    if not success:
        return jsonify({'error': message}), 400
    return jsonify({'success': True, 'message': message})
