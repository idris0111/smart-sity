import logging
from django.core.cache import cache
from django.db import transaction
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from redis.exceptions import RedisError
from .models import Route, RouteStop, BusStop, Vehicle, TrafficIncident, ServiceRequest, ParkingBooking, Camera, CameraAlert, ParkingLot, ParkingSpot
from .serializer import VehicleSerializer, TrafficIncidentSerializer, ServiceRequestSerializer, ParkingBookingSerializer
from .realtime import publish, publish_private


@receiver(post_save, sender=Camera)
@receiver(post_delete, sender=Camera)
def camera_changed(sender, instance, signal, **kwargs):
    from .cameras import CameraSerializer
    if signal is post_delete or not instance.is_active or not instance.rights_confirmed:
        event = {'kind': 'camera.deleted', 'data': {'id': instance.pk}}
    else:
        event = {'kind': 'camera.updated', 'data': CameraSerializer(instance).data}
    transaction.on_commit(lambda: publish('city.cameras', event))


@receiver(post_save, sender=CameraAlert)
def alert_changed(sender, instance, **kwargs):
    from .cameras import CameraAlertSerializer
    event = {'kind': 'alert.updated', 'data': CameraAlertSerializer(instance).data}
    transaction.on_commit(lambda: publish('city.admin', event))


@receiver(post_save, sender=ParkingLot)
@receiver(post_delete, sender=ParkingLot)
@receiver(post_save, sender=ParkingSpot)
@receiver(post_delete, sender=ParkingSpot)
def infrastructure_changed(sender, instance, signal, **kwargs):
    from .serializer import ParkingLotSerializer, ParkingSpotSerializer
    kind, serializer = ('parking', ParkingLotSerializer) if sender is ParkingLot else ('spot', ParkingSpotSerializer)
    event = {'kind': f'{kind}.deleted' if signal is post_delete else f'{kind}.updated',
             'data': {'id': instance.pk} if signal is post_delete else serializer(instance).data}
    transaction.on_commit(lambda: publish('city.infrastructure', event))


@receiver([post_save, post_delete], sender=Route)
@receiver([post_save, post_delete], sender=RouteStop)
@receiver([post_save, post_delete], sender=BusStop)
def invalidate_routes(sender, **kwargs):
    def clear():
        try:
            cache.delete('city:routes')
        except RedisError:
            logging.getLogger(__name__).exception('Route cache invalidation failed')
    transaction.on_commit(clear)


@receiver(post_save, sender=Vehicle)
def vehicle_saved(sender, instance, **kwargs):
    event = {'kind': 'vehicle.updated', 'data': VehicleSerializer(instance).data}
    transaction.on_commit(lambda: publish('city.vehicles', event))


@receiver(post_save, sender=TrafficIncident)
def incident_saved(sender, instance, created, **kwargs):
    event = {'kind': 'incident.created' if created else 'incident.updated',
             'data': TrafficIncidentSerializer(instance).data}
    transaction.on_commit(lambda: publish_private(instance.created_by_id, event))


@receiver(post_save, sender=ServiceRequest)
def request_saved(sender, instance, created, **kwargs):
    event = {'kind': 'request.created' if created else 'request.updated',
             'data': ServiceRequestSerializer(instance).data}
    transaction.on_commit(lambda: publish_private(instance.user_id, event))


@receiver(post_save, sender=ParkingBooking)
def booking_saved(sender, instance, **kwargs):
    event = {'kind': 'booking.updated', 'data': ParkingBookingSerializer(instance).data}
    transaction.on_commit(lambda: publish_private(instance.user_id, event))


@receiver(post_delete, sender=Vehicle)
@receiver(post_delete, sender=TrafficIncident)
@receiver(post_delete, sender=ServiceRequest)
@receiver(post_delete, sender=ParkingBooking)
def record_deleted(sender, instance, **kwargs):
    kind = {Vehicle: 'vehicle', TrafficIncident: 'incident', ServiceRequest: 'request', ParkingBooking: 'booking'}[sender]
    event = {'kind': f'{kind}.deleted', 'data': {'id': instance.pk}}
    if sender is Vehicle:
        transaction.on_commit(lambda: publish('city.vehicles', event))
    else:
        owner = instance.created_by_id if sender is TrafficIncident else instance.user_id
        transaction.on_commit(lambda: publish_private(owner, event))
