import smtplib
from email.message import EmailMessage
from typing import Optional
from core.config import settings
import logging

logger = logging.getLogger(__name__)


def _build_message(subject: str, to_email: str, html_body: str, text_body: Optional[str] = None) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>" if settings.SMTP_FROM_NAME and settings.SMTP_FROM_EMAIL else (settings.SMTP_FROM_EMAIL or "no-reply@example.com")
    msg["To"] = to_email
    if text_body:
        msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    return msg


def send_email(subject: str, to_email: str, html_body: str, text_body: Optional[str] = None) -> bool:
    if not getattr(settings, 'SMTP_HOST', None) or not getattr(settings, 'SMTP_FROM_EMAIL', None):
        logger.warning("SMTP not configured; skipping email send")
        return False
    try:
        msg = _build_message(subject, to_email, html_body, text_body)
        # SSL (SMTPS) or STARTTLS
        timeout = getattr(settings, 'SMTP_TIMEOUT', 15) or 15
        debug = 1 if getattr(settings, 'SMTP_DEBUG', False) else 0
        if getattr(settings, 'SMTP_USE_SSL', False):
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout) as server:
                server.set_debuglevel(debug)
                # if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=timeout) as server:
                server.set_debuglevel(debug)
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
        logger.info(f"Sent email to {to_email} with subject '{subject}'")
        return True
    except Exception as exc:
        logger.error(f"Failed to send email to {to_email}: {exc}")
        return False


def send_otp_email(to_email: str, otp_code: str) -> bool:
    subject = "Your Valuesubs password reset OTP"
    text = f"Your OTP code is {otp_code}. It expires in 10 minutes."
    html = f"""
    <div style='font-family: Arial, sans-serif; line-height: 1.5;'>
      <h2>Reset your password</h2>
      <p>Use the following One-Time Password (OTP) to reset your password. This code will expire in <strong>10 minutes</strong>.</p>
      <p style='font-size: 24px; font-weight: bold; letter-spacing: 4px;'>{otp_code}</p>
      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <p>— {settings.SMTP_FROM_NAME or 'Valuesubs'} Team</p>
    </div>
    """
    return send_email(subject, to_email, html, text)


