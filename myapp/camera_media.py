"""Allowlisted camera transport. Credentials stay on the server."""
import base64
import hashlib
import ipaddress
import json
import re
import socket
import time
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.exceptions import AuthenticationFailed, ValidationError


def validate_camera_url(url):
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        raise ValidationError('Invalid camera URL or port.') from None
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValidationError('Camera URL must be HTTP(S), without embedded credentials.')
    if parsed.hostname not in settings.CAMERA_ALLOWED_HOSTS:
        raise ValidationError('Add the authorized camera host to CAMERA_ALLOWED_HOSTS first.')
    if not settings.CAMERA_ALLOW_PRIVATE:
        try:
            addresses = socket.getaddrinfo(parsed.hostname, port or (443 if parsed.scheme == 'https' else 80))
        except OSError:
            raise ValidationError('Camera host cannot be resolved.') from None
        if any(not ipaddress.ip_address(record[4][0]).is_global for record in addresses):
            raise ValidationError('Private camera networks require CAMERA_ALLOW_PRIVATE=1.')
    return url


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def open_camera(url, timeout=8, method='GET', data=None, headers=None):
    # Each redirect and each playlist asset is checked again.
    from urllib.error import HTTPError
    for _ in range(5):
        validate_camera_url(url)
        try:
            return build_opener(NoRedirect).open(Request(url, data=data, method=method, headers={'User-Agent': 'SmartCity/1.0', **(headers or {})}), timeout=timeout)
        except HTTPError as error:
            if error.code not in (301, 302, 303, 307, 308):
                raise
            url = urljoin(url, error.headers.get('Location', ''))
    raise ValidationError('Too many camera redirects.')


def cipher():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def media_ticket(camera, user, url):
    return cipher().encrypt(json.dumps({'camera': camera.pk, 'user': user.pk, 'url': url}).encode()).decode()


def read_ticket(token, camera):
    try:
        data = json.loads(cipher().decrypt(token.encode(), ttl=300))
        if data['camera'] != camera.pk:
            raise ValueError()
        user = get_user_model().objects.get(pk=data['user'], is_active=True)
        if not camera.is_active or not camera.rights_confirmed:
            raise ValueError()
        return user, validate_camera_url(data['url'])
    except (InvalidToken, ValueError, KeyError, TypeError, get_user_model().DoesNotExist):
        raise AuthenticationFailed('Camera access expired. Reopen the viewer.') from None


def proxy_playlist(text, url, camera, user):
    def rewrite(resource):
        target = validate_camera_url(urljoin(url, resource))
        return f'/api/cameras/{camera.pk}/stream/?ticket={media_ticket(camera, user, target)}'
    lines = []
    for line in text.splitlines():
        if line.startswith('#'):
            line = re.sub(r'URI="([^"]+)"', lambda match: f'URI="{rewrite(match.group(1))}"', line)
        elif line.strip():
            line = rewrite(line.strip())
        lines.append(line)
    return '\n'.join(lines) + '\n'


def snapshot(camera):
    url = camera.preview_url or (camera.stream_url if camera.stream_type == 'SNAPSHOT' else '')
    if not camera.rights_confirmed or not camera.is_active or not url:
        raise ValidationError('No authorized snapshot configured.')
    with open_camera(url) as response:
        content_type = response.headers.get_content_type()
        data = response.read(3 * 1024 * 1024 + 1)
    if content_type not in ('image/jpeg', 'image/png') or len(data) > 3 * 1024 * 1024:
        raise ValidationError('Snapshot must be a JPEG/PNG image smaller than 3 MB.')
    return data, content_type
