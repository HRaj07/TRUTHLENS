import os
import logging
import json
import urllib.request
import urllib.error

log = logging.getLogger("truthlens")

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send an OTP code using SendGrid HTTP API."""
    sender_email = os.environ.get("GMAIL_ADDRESS")
    api_key = os.environ.get("SENDGRID_API_KEY")

    if not sender_email or not api_key:
        log.error("GMAIL_ADDRESS or SENDGRID_API_KEY not set in environment.")
        return False

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #333333; text-align: center;">TruthLens Password Reset</h2>
          <p style="color: #555555; font-size: 16px;">You requested a password reset. Here is your 6-digit verification code:</p>
          <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; margin: 20px 0; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #00ffcc; text-shadow: 1px 1px 2px #333;">{otp_code}</span>
          </div>
          <p style="color: #777777; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
          <p style="color: #777777; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;" />
          <p style="color: #aaaaaa; font-size: 12px; text-align: center;">&copy; 2026 TruthLens. All rights reserved.</p>
        </div>
      </body>
    </html>
    """

    data = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": sender_email, "name": "TruthLens"},
        "subject": "TruthLens - Your Password Reset Code",
        "content": [{"type": "text/html", "value": html_body}]
    }

    req = urllib.request.Request("https://api.sendgrid.com/v3/mail/send")
    req.add_header("Authorization", f"Bearer {api_key}")
    req.add_header("Content-Type", "application/json")
    
    try:
        urllib.request.urlopen(req, json.dumps(data).encode("utf-8"))
        return True
    except urllib.error.URLError as e:
        error_msg = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
        log.error(f"Failed to send email via SendGrid: {error_msg}")
        return False
