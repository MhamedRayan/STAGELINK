import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

def create_official_internship_record(application) -> bool:
    """
    Calls Internship Management Service synchronously to generate official internship.
    Returns True on success, False on failure.
    """
    url = settings.INTERNSHIP_SERVICE_URL
    headers = {
        'Authorization': f'Bearer {settings.INTERNAL_SERVICE_TOKEN}',
        'X-Idempotency-Key': str(application.id),
        'Content-Type': 'application/json'
    }
    
    payload = {
        'application_id': str(application.id),
        'offer_id': str(application.offer_id),
        'student_user_id': str(application.student_user_id),
        'company_id': str(application.company_id),
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=5.0)
        if response.status_code in (200, 201):
            logger.info(f"Internship record created successfully for App {application.id}")
            return True
        else:
            logger.error(f"Internship creation failed [{response.status_code}]: {response.text}")
            return False
    except requests.RequestException as e:
        logger.error(f"Network failure connecting to Internship service: {str(e)}")
        return False
