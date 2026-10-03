from celery import shared_task
from django.db import transaction
from django.utils import timezone
from .models import ParkingBooking, RouteStop, Vehicle


@shared_task
def check_camera_health():
    import time
    from django.core.cache import cache
    from redis.exceptions import RedisError
    from .models import Camera
    from .camera_media import open_camera
    checked = 0
    for camera in Camera.objects.filter(is_active=True, rights_confirmed=True):
        started = time.monotonic()
        try:
            with open_camera(camera.preview_url or camera.stream_url, timeout=5, method='HEAD' if camera.stream_type == 'WEBRTC' and not camera.preview_url else 'GET') as response:
                response.read(1)
            camera.latency_ms = round((time.monotonic() - started) * 1000)
            camera.status = 'SLOW' if camera.latency_ms > 2000 else 'ONLINE'
            camera.last_seen = timezone.now()
        except Exception:
            camera.status, camera.latency_ms = 'OFFLINE', None
        camera.save(update_fields=['status', 'latency_ms', 'last_seen', 'updated_at'])
        try:
            cache.set(f'city:camera:{camera.pk}', {'status': camera.status, 'latency_ms': camera.latency_ms}, timeout=120)
        except RedisError:
            pass
        checked += 1
    return checked


@shared_task
def analyze_camera(alert_id):
    import base64
    from .models import CameraAlert
    from .camera_media import snapshot
    from .ai import ask_provider
    alert = CameraAlert.objects.select_related('camera').get(pk=alert_id)
    try:
        image, content_type = snapshot(alert.camera)
        if content_type != 'image/jpeg':
            raise ValueError('AI requires a JPEG snapshot.')
        result = ask_provider({'task': 'camera', 'image': 'data:image/jpeg;base64,' + base64.b64encode(image).decode()})
        alert.answer = result['answer']
        confidence = result.get('confidence')
        alert.confidence = confidence if isinstance(confidence, (int, float)) and 0 <= confidence <= 1 else None
        alert.status = 'REVIEW'
    except Exception:
        alert.status, alert.error = 'FAILED', 'Snapshot or AI service unavailable.'
    alert.save(update_fields=['answer', 'confidence', 'status', 'error', 'updated_at'])
    return alert.status


@shared_task
def check_expired_bookings():
    count = 0
    with transaction.atomic():
        for booking in ParkingBooking.objects.select_for_update().filter(
                status='BOOKED', end_time__lt=timezone.now()):
            booking.status = 'COMPLETED'
            booking.save(update_fields=['status'])
            count += 1
    return count


@shared_task
def move_demo_vehicle():
    with transaction.atomic():
        vehicle = Vehicle.objects.select_for_update().filter(
            plate_number='DEMO-88-01', route__name='DEMO Route 88', is_active=True).first()
        if vehicle is None:
            return False
        from .models import RouteGeometry
        from .route_motion import position_at
        geometry = RouteGeometry.objects.filter(route=vehicle.route).first()
        if not geometry:
            return False
        # 8 m/s, 10-second Beat interval. The simulation is explicitly labelled DEMO.
        point, progress = position_at(geometry.geometry['coordinates'], vehicle.demo_progress_m + 80)
        vehicle.longitude, vehicle.latitude = point
        vehicle.demo_progress_m = progress
        vehicle.save(update_fields=['latitude', 'longitude', 'demo_progress_m', 'updated_at'])
    return True
