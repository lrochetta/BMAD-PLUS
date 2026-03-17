#!/usr/bin/env python3
"""
BMAD+ Notification System
Supports WhatsApp (via Evolution API) with email fallback.
"""

import json
import smtplib
from email.mime.text import MIMEText

try:
    import requests
except ImportError:
    requests = None


def notify_whatsapp(message, config):
    """Send notification via WhatsApp using Evolution API.
    
    Args:
        message: Text message to send
        config: WhatsApp configuration dict with keys:
            - evolution_api_url: Base URL of Evolution API (e.g., http://localhost:8080)
            - api_key: Evolution API authentication key
            - instance_name: Instance name (e.g., bmad-monitor)  
            - phone_number: Recipient phone number with country code
    """
    if requests is None:
        print("ERROR: 'requests' library not installed. Run: pip install requests")
        return False

    url = f"{config['evolution_api_url']}/message/sendText/{config['instance_name']}"
    headers = {
        "Content-Type": "application/json",
        "apikey": config["api_key"]
    }
    payload = {
        "number": config["phone_number"],
        "text": message
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        print(f"WhatsApp message sent to {config['phone_number']}")
        return True
    except requests.exceptions.ConnectionError:
        print(f"ERROR: Cannot connect to Evolution API at {config['evolution_api_url']}")
        return False
    except requests.exceptions.HTTPError as e:
        print(f"ERROR: WhatsApp API returned {e.response.status_code}: {e.response.text}")
        return False
    except Exception as e:
        print(f"ERROR: WhatsApp notification failed: {e}")
        return False


def notify_fallback(message, email_config):
    """Send notification via email as fallback.
    
    Args:
        message: Text message to send
        email_config: Email configuration dict with keys:
            - smtp_host, smtp_port, username, password, from_addr, to_addr
    """
    try:
        # Strip WhatsApp formatting for email
        clean_message = message.replace("*", "").replace("_", "")
        
        msg = MIMEText(clean_message, "plain", "utf-8")
        msg["Subject"] = "BMAD+ Weekly Upstream Report"
        msg["From"] = email_config["from_addr"]
        msg["To"] = email_config["to_addr"]

        with smtplib.SMTP(email_config["smtp_host"], email_config["smtp_port"]) as server:
            server.starttls()
            server.login(email_config["username"], email_config["password"])
            server.send_message(msg)
        
        print(f"Email sent to {email_config['to_addr']}")
        return True
    except Exception as e:
        print(f"ERROR: Email notification failed: {e}")
        return False
