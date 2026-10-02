from celery import shared_task
from django.db import transaction
from django.utils import timezone
from .models import ParkingBooking, RouteStop, Vehicle


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
        stops = list(RouteStop.objects.filter(route=vehicle.route).select_related('stop'))
        if not stops:
            return False
        current = next((i for i, item in enumerate(stops)
                        if item.stop.latitude == vehicle.latitude and item.stop.longitude == vehicle.longitude), -1)
        stop = stops[(current + 1) % len(stops)].stop
        vehicle.latitude, vehicle.longitude = stop.latitude, stop.longitude
        vehicle.save(update_fields=['latitude', 'longitude'])
    return True
