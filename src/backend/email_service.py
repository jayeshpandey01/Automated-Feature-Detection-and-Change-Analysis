import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path

# SMTP Settings from environment variables with defaults
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@glaciowatch.org")

# Fallback logs directory for local simulation
MOCK_EMAIL_DIR = Path(__file__).parent.parent.parent / "logs" / "sent_emails"
MOCK_EMAIL_DIR.mkdir(parents=True, exist_ok=True)

def send_email(to_email: str, subject: str, html_content: str):
    """
    Sends an email using configured SMTP parameters.
    If no SMTP host is configured, it falls back to writing the email to a local mock log file.
    """
    # Check if SMTP configuration is provided
    if not SMTP_HOST or not SMTP_USER:
        # Fallback Mock Mode: Log the email to file for easy local development verification
        mock_file = MOCK_EMAIL_DIR / f"{to_email}_{int(os.urandom(4).hex(), 16)}.html"
        email_data = f"Subject: {subject}\nTo: {to_email}\nFrom: {SENDER_EMAIL}\n\n{html_content}"
        with open(mock_file, "w", encoding="utf-8") as f:
            f.write(email_data)
        
        print(f"[MOCK EMAIL] Written email to {mock_file}")
        # Print OTP highlight in console for easy copy-paste
        if "OTP" in subject:
            import re
            otp_match = re.search(r"\b\d{6}\b", html_content)
            if otp_match:
                print(f"--------------------------------------------------")
                print(f"   [MOCK OTP ALERT] Email: {to_email} | OTP: {otp_match.group(0)}")
                print(f"--------------------------------------------------")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SENDER_EMAIL
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect to SMTP server
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        server.quit()
        print(f"[SMTP EMAIL] Successfully sent email to {to_email}")
        return True
    except Exception as e:
        print(f"[SMTP EMAIL ERROR] Failed to send email to {to_email}: {e}")
        return False

def send_otp_email(to_email: str, otp: str):
    subject = "GlacioWatch - Verify Your Email OTP"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #ffffff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #161f30; padding: 30px; border-radius: 10px; border: 1px solid #00f3ff;">
                <h2 style="color: #00f3ff; font-family: serif; letter-spacing: 2px;">🏔️ GLACIOWATCH</h2>
                <p>Welcome to GlacioWatch, your Himalayan glacier monitoring command center.</p>
                <p>Use the following 6-digit One-Time Password (OTP) to verify your email address:</p>
                <div style="font-size: 32px; font-weight: bold; background-color: #0b0f19; border: 1px solid #00f3ff; color: #00f3ff; text-align: center; padding: 15px; margin: 20px 0; border-radius: 5px; letter-spacing: 5px;">
                    {otp}
                </div>
                <p style="font-size: 12px; color: #888;">This OTP is valid for 10 minutes. If you did not request this email, please ignore it.</p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)

def send_alert_email(to_email: str, glacier_name: str, region: str, risk_level: str, change_rate: str):
    subject = f"⚠️ CRITICAL GLACIER ALERT: {glacier_name} ({risk_level} Risk)"
    html_content = f"""
    <html>
        <body style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #ffffff; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #1c1417; padding: 30px; border-radius: 10px; border: 1px solid #ff4a4a;">
                <h2 style="color: #ff4a4a; font-family: serif; letter-spacing: 2px;">⚠️ GLACIOWATCH RISK ALERT</h2>
                <p>Our automated AI satellite analysis has detected anomalous activity or a critical rate of retreat at the following glacier:</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr style="border-bottom: 1px solid #333;">
                        <td style="padding: 10px 0; font-weight: bold; color: #aaa;">Glacier Name:</td>
                        <td style="padding: 10px 0; font-weight: bold; color: #fff;">{glacier_name}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #333;">
                        <td style="padding: 10px 0; font-weight: bold; color: #aaa;">Region:</td>
                        <td style="padding: 10px 0; color: #fff;">{region}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #333;">
                        <td style="padding: 10px 0; font-weight: bold; color: #aaa;">Risk Assessment:</td>
                        <td style="padding: 10px 0; font-weight: bold; color: #ff4a4a;">{risk_level}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #333;">
                        <td style="padding: 10px 0; font-weight: bold; color: #aaa;">Retreat Rate:</td>
                        <td style="padding: 10px 0; color: #fff;">{change_rate}</td>
                    </tr>
                </table>
                
                <p>Please log in to the GlacioWatch Command Center Dashboard to review the full spatial distribution maps and AI Scientist analyses.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="http://localhost:3000/dashboard" style="background-color: #ff4a4a; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Open Command Center</a>
                </div>
                <p style="font-size: 11px; color: #666; margin-top: 30px;">You are receiving this automated early-warning alert because you subscribed to GlacioWatch hazard notifications.</p>
            </div>
        </body>
    </html>
    """
    return send_email(to_email, subject, html_content)
