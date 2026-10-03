"""Actual service health and optional GeoJSON layers; no simulated provider data."""
import json
import os
from urllib.request import Request, urlopen
from urllib.error import URLError
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import NotFound
from redis import Redis
from redis.exceptions import RedisError
from .ai import AIUnavailable

LAYER_KEYS = ('weather', 'air', 'traffic', 'poi', 'crowd', 'news')

def layer_url(key):
    return os.environ.get(f'CITY_LAYER_{key.upper()}_URL', '')

class SystemStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        database = 'offline'
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                if cursor.fetchone()[0] == 1:
                    database = 'online'
        except Exception:
            pass
        redis, worker = 'disabled', 'offline'
        if settings.USE_REDIS:
            try:
                client = Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=0.5, socket_timeout=0.5)
                redis = 'online' if client.ping() else 'offline'
                client.close()
                worker = cache.get('city:worker-status')
                if worker is None:
                    from core.celery import app
                    worker = 'online' if app.control.inspect(timeout=0.7).ping() else 'offline'
                    cache.set('city:worker-status', worker, timeout=20)
            except (RedisError, OSError, ValueError):
                redis, worker = 'offline', 'offline'
        return Response({'database': database, 'redis': redis, 'worker': worker,
                         'realtime': settings.REALTIME_ENABLED,
                         'ai': bool(os.environ.get('SMART_CITY_AI_URL') and os.environ.get('SMART_CITY_AI_KEY')),
                         'camera_hosts_configured': bool(settings.CAMERA_ALLOWED_HOSTS),
                         'layers': [{'key': key, 'label': key, 'configured': bool(layer_url(key))} for key in LAYER_KEYS]})

class ExternalLayerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, key):
        if key not in LAYER_KEYS:
            raise NotFound()
        url = layer_url(key)
        if not url:
            raise AIUnavailable('Layer provider is not configured.')
        try:
            saved = cache.get(f'city:layer:{key}')
            if saved:
                return Response(saved)
        except RedisError:
            pass
        try:
            headers = {'Accept': 'application/geo+json, application/json'}
            token = os.environ.get(f'CITY_LAYER_{key.upper()}_TOKEN')
            if token:
                headers['Authorization'] = f'Bearer {token}'
            with urlopen(Request(url, headers=headers), timeout=8) as upstream:
                raw = upstream.read(4 * 1024 * 1024 + 1)
            if len(raw) > 4 * 1024 * 1024:
                raise ValueError()
            data = json.loads(raw)
            if data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list) or len(data['features']) > 5000:
                raise ValueError()
            for feature in data['features']:
                if feature.get('type') != 'Feature' or feature.get('geometry', {}).get('type') not in ('Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'):
                    raise ValueError()
            result = {'key': key, 'label': key, 'updated_at': timezone.now().isoformat(), 'data': data}
        except (URLError, OSError, ValueError, TypeError, AttributeError):
            raise AIUnavailable('Layer provider unavailable or returned invalid GeoJSON.') from None
        try:
            cache.set(f'city:layer:{key}', result, timeout=60)
        except RedisError:
            pass
        return Response(result)
