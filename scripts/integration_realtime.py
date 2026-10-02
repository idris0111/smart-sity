"""Live PostgreSQL + Redis + Worker/Beat + network WebSocket verification.

Run: python run_backend.py --module scripts.integration_realtime
Install requirements-dev.txt first. Redis, ASGI and Celery must already run.
Add --beat to also wait for the actual periodic scheduler (up to 80 seconds).
"""
import asyncio
import json
import os
import sys
import uuid
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

import redis
import websockets
from channels.db import database_sync_to_async
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from datetime import timedelta
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APIClient
from myapp.models import ParkingLot, ParkingSpot, ParkingBooking, Vehicle, TrafficIncident, ServiceRequest
from myapp.tasks import check_expired_bookings, move_demo_vehicle


def prepare():
    assert connection.vendor == 'postgresql', 'Integration requires PostgreSQL'
    assert settings.CACHES['default']['BACKEND'].endswith('RedisCache')
    assert settings.CHANNEL_LAYERS['default']['BACKEND'].endswith('RedisChannelLayer')
    client = redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=2)
    assert client.ping()
    name = 'integration_' + uuid.uuid4().hex[:10]
    owner = get_user_model().objects.create_user(username=name)
    other = get_user_model().objects.create_user(username=name+'_other')
    lot = ParkingLot.objects.create(name=name, address='Temporary integration test', latitude=38, longitude=68)
    spot = ParkingSpot.objects.create(parking=lot, number='TEST')
    api = APIClient()
    api.force_authenticate(owner)
    cache.delete('city:routes')
    assert api.get('/api/routes/').status_code == 200
    assert cache.get('city:routes') is not None
    cache_client = redis.Redis.from_url(settings.CACHES['default']['LOCATION'], socket_connect_timeout=2)
    assert 0 < cache_client.ttl(cache.make_key('city:routes')) <= 60
    print('OK actual Redis route cache and TTL')
    return owner, other, lot, spot


async def wait_event(socket, kind):
    while True:
        event = json.loads(await asyncio.wait_for(socket.recv(), 15))
        if event['kind'] == kind:
            return event


async def connect(user):
    token = await database_sync_to_async(lambda: str(RefreshToken.for_user(user).access_token))()
    socket = await websockets.connect(os.environ.get('INTEGRATION_WS_URL', 'ws://127.0.0.1:8000/ws/city/'), origin='http://localhost:5173')
    await socket.send(json.dumps({'type': 'authenticate', 'access': token}))
    assert json.loads(await socket.recv())['kind'] == 'connected'
    return socket


async def main():
    owner, other, lot, spot = await database_sync_to_async(prepare)()
    first = second = None
    try:
        first, second = await connect(owner), await connect(other)
        incident = await database_sync_to_async(TrafficIncident.objects.create)(created_by=owner,
            title='Temporary integration test', description='Temporary', incident_type='OTHER', latitude=38, longitude=68)
        assert (await wait_event(first, 'incident.created'))['data']['id'] == incident.pk
        try:
            await asyncio.wait_for(second.recv(), 0.3)
            raise AssertionError('Another user received a private event')
        except asyncio.TimeoutError:
            pass
        print('OK real Redis channel layer and private WebSocket delivery')
        service = await database_sync_to_async(ServiceRequest.objects.create)(user=owner,
            request_type='ROAD', description='Temporary', latitude=38, longitude=68)
        await wait_event(first, 'request.created')
        service.status = 'DONE'
        await database_sync_to_async(service.save)(update_fields=['status'])
        assert (await wait_event(first, 'request.updated'))['data']['status'] == 'DONE'
        print('OK request status notification')
        booking = await database_sync_to_async(ParkingBooking.objects.create)(user=owner, parking_spot=spot,
            start_time=timezone.now()-timedelta(hours=2), end_time=timezone.now()-timedelta(hours=1))
        await wait_event(first, 'booking.updated')
        await database_sync_to_async(check_expired_bookings.delay)()
        assert (await wait_event(first, 'booking.updated'))['data']['status'] == 'COMPLETED'
        await database_sync_to_async(booking.refresh_from_db)()
        assert booking.status == 'COMPLETED'
        print('OK Redis broker -> actual Celery worker -> PostgreSQL -> WebSocket')
        await database_sync_to_async(move_demo_vehicle.delay)()
        vehicle_event = await wait_event(first, 'vehicle.updated')
        assert vehicle_event['data']['plate_number'] == 'DEMO-88-01'
        print('OK demo simulation via worker and WebSocket')
        if '--beat' in sys.argv:
            booking.status = 'BOOKED'
            await database_sync_to_async(booking.save)(update_fields=['status'])
            for _ in range(80):
                await asyncio.sleep(1)
                await database_sync_to_async(booking.refresh_from_db)()
                if booking.status == 'COMPLETED':
                    break
            assert booking.status == 'COMPLETED', 'Beat did not complete the expired booking'
            print('OK actual Celery Beat periodic task')
    finally:
        if first: await first.close()
        if second: await second.close()
        await database_sync_to_async(owner.delete)()
        await database_sync_to_async(other.delete)()
        await database_sync_to_async(lot.delete)()


if __name__ == '__main__':
    asyncio.run(main())
