import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

settings = get_settings()


def build_whatsapp_template(
    student_name: str,
    batch_name: str,
    due_amount: str,
    due_date: str,
) -> str:
    return (
        f"Hello {student_name}, this is a fee reminder for {batch_name}. "
        f"Amount due: {due_amount}. Due date: {due_date}. "
        "Please pay at the earliest. Thank you."
    )


def send_email_if_configured(recipient: str, subject: str, message: str) -> bool:
    if not all([settings.smtp_host, settings.smtp_user, settings.smtp_password, settings.smtp_sender]):
        return False

    email = EmailMessage()
    email["From"] = settings.smtp_sender
    email["To"] = recipient
    email["Subject"] = subject
    email.set_content(message)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(email)
    return True

