"""Small adapter for a user-configured HTTP AI gateway (see README)."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings
from rest_framework.exceptions import APIException


class AIUnavailable(APIException):
    status_code = 503
    default_detail = 'AI is not configured.'


def provider_configured():
    return bool(os.environ.get('SMART_CITY_AI_URL') and os.environ.get('SMART_CITY_AI_KEY'))


def ask_provider(payload):
    url = os.environ.get('SMART_CITY_AI_URL')
    key = os.environ.get('SMART_CITY_AI_KEY')
    if not url or not key:
        raise AIUnavailable()
    prompt = (settings.BASE_DIR / 'myapp' / 'ai_prompt.txt').read_text(encoding='utf-8')
    request = Request(url, data=json.dumps({'system': prompt, **payload}).encode(),
                      headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'},
                      method='POST')
    try:
        with urlopen(request, timeout=30) as response:
            result = json.loads(response.read(1024 * 1024))
        if not isinstance(result, dict) or not isinstance(result.get('answer'), str):
            raise ValueError('Invalid AI response')
        return result
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        raise AIUnavailable('AI provider unavailable or returned an invalid response.')
