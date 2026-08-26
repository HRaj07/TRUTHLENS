import smtplib
import os
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

log = logging.getLogger("truthlens")

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send an OTP code to the given email address using Gmail SMTP."""
    gmail_address = os.environ.get("GMAIL_ADDRESS")
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD")

    if not gmail_address or not gmail_password:
        log.error("GMAIL_ADDRESS or GMAIL_APP_PASSWORD not set in environment.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "TruthLens - Your Password Reset Code"
    msg["From"] = f"TruthLens <{gmail_address}>"
    msg["To"] = to_email

    # Create HTML body
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

    part2 = MIMEText(html_body, "html")
    msg.attach(part2)

    try:
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()
        server.login(gmail_address, gmail_password)
        server.sendmail(gmail_address, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        log.error(f"Failed to send email to {to_email}: {str(e)}")
        return False
