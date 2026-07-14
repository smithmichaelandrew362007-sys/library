from models import get_db

def send_message(member_id, sender_id, message_text):
    """Send a message/notification to a member."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO messages (member_id, sender_id, message)
           VALUES (%s, %s, %s)""",
        (member_id, sender_id, message_text)
    )
    conn.commit()
    conn.close()
    return True

def get_messages(member_id):
    """Get all messages for a member."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT m.*, sender.name as sender_name 
           FROM messages m
           LEFT JOIN members sender ON m.sender_id = sender.member_id
           WHERE m.member_id = %s
           ORDER BY m.sent_at DESC""",
        (member_id,)
    )
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return messages

def mark_as_read(message_id, member_id):
    """Mark a message as read."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE messages SET is_read = TRUE WHERE message_id = %s AND member_id = %s",
        (message_id, member_id)
    )
    conn.commit()
    conn.close()
    return True
