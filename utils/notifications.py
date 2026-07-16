"""
utils/notifications.py
─────────────────────
Sends email and SMS notifications to students.

Configuration (set in environment variables or config.py):
  MAIL_SENDER      — Gmail address to send from
  MAIL_APP_PASSWORD — Gmail App Password (NOT your regular Gmail password)
                      Get one at: https://myaccount.google.com/apppasswords
  FAST2SMS_API_KEY — (Optional) Fast2SMS API key for SMS
                     Get one free at: https://fast2sms.com
"""

import smtplib
import os
import requests as http_requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ─── Read config from environment ────────────────────────────────────
MAIL_SENDER       = os.environ.get('MAIL_SENDER', '')
MAIL_APP_PASSWORD = os.environ.get('MAIL_APP_PASSWORD', '')
FAST2SMS_API_KEY  = os.environ.get('FAST2SMS_API_KEY', '')


def send_email(to_email: str, subject: str, body: str) -> bool:
    """
    Send an email via Gmail SMTP.
    Returns True on success, False on failure (never raises).
    """
    if not MAIL_SENDER or not MAIL_APP_PASSWORD:
        print("[WARN] Email not configured. Set MAIL_SENDER and MAIL_APP_PASSWORD env vars.")
        return False
    if not to_email or '@' not in to_email:
        print(f"[WARN] Invalid email address: {to_email!r}")
        return False

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = f"LibraVault Library <{MAIL_SENDER}>"
        msg['To']      = to_email

        # Plain text version
        text_part = MIMEText(body, 'plain')

        # HTML version (prettier in Gmail)
        html_body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;
                    border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1a1a2e; padding: 20px; text-align: center;">
                <h2 style="color: #fff; margin: 0;">📚 LibraVault</h2>
                <p style="color: #aaa; margin: 4px 0 0;">Library Management System</p>
            </div>
            <div style="padding: 28px 24px; background: #fff;">
                <p style="font-size: 15px; color: #333; line-height: 1.6;">{body.replace(chr(10), '<br>')}</p>
            </div>
            <div style="background: #f5f5f5; padding: 12px 24px; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                    This is an automated message from LibraVault. Please do not reply.
                </p>
            </div>
        </div>
        """
        html_part = MIMEText(html_body, 'html')

        msg.attach(text_part)
        msg.attach(html_part)

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(MAIL_SENDER, MAIL_APP_PASSWORD)
            server.sendmail(MAIL_SENDER, to_email, msg.as_string())

        print(f"[OK] Email sent to {to_email}")
        return True

    except Exception as e:
        print(f"[ERROR] Failed to send email to {to_email}: {e}")
        return False


def send_sms(to_mobile: str, body: str) -> bool:
    """
    Send an SMS via Fast2SMS (India).
    Returns True on success, False on failure (never raises).
    Docs: https://docs.fast2sms.com
    """
    if not FAST2SMS_API_KEY:
        print("[WARN] SMS not configured. Set FAST2SMS_API_KEY env var to enable SMS.")
        return False
    if not to_mobile:
        return False

    # Normalize: strip country code, keep last 10 digits
    mobile = to_mobile.strip().replace('+91', '').replace(' ', '')
    if len(mobile) < 10:
        print(f"[WARN] Invalid mobile number: {to_mobile!r}")
        return False
    mobile = mobile[-10:]  # ensure 10 digits

    try:
        response = http_requests.post(
            'https://www.fast2sms.com/dev/bulkV2',
            headers={'authorization': FAST2SMS_API_KEY},
            data={
                'route':    'q',     # Quick/Transactional route
                'message':  body,
                'language': 'english',
                'flash':    0,
                'numbers':  mobile,
            },
            timeout=10
        )
        result = response.json()
        if result.get('return'):
            print(f"[OK] SMS sent to {mobile}")
            return True
        else:
            print(f"[ERROR] Fast2SMS error: {result}")
            return False

    except Exception as e:
        print(f"[ERROR] Failed to send SMS to {mobile}: {e}")
        return False
