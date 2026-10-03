"""Bounded, permission-scoped city context and harmless map actions."""
import math
from django.utils import timezone
from .models import Camera, ParkingLot, ParkingSpot, ParkingBooking, BusStop, Route, Vehicle, TrafficIncident, ServiceRequest

def city_context(user):
    incidents = TrafficIncident.objects.all() if user.is_staff else TrafficIncident.objects.filter(created_by=user)
    requests = ServiceRequest.objects.all() if user.is_staff else ServiceRequest.objects.filter(user=user)
    now = timezone.now()
    booked = ParkingBooking.objects.filter(status='BOOKED', start_time__lte=now, end_time__gt=now).values_list('parking_spot_id', flat=True)
    return {
        'observed_at': now.isoformat(), 'city': 'Dushanbe',
        'data_note': 'DEMO names indicate demonstration data, not official GPS or traffic information.',
        'cameras': list(Camera.objects.filter(is_active=True, rights_confirmed=True).values('id','name','latitude','longitude','status')[:100]),
        'parkings': [{**lot, 'free_now': ParkingSpot.objects.filter(parking_id=lot['id'], is_active=True).exclude(pk__in=booked).count()} for lot in ParkingLot.objects.filter(is_active=True).values('id','name','latitude','longitude')[:100]],
        'stops': list(BusStop.objects.values('id','name','latitude','longitude')[:100]),
        'routes': list(Route.objects.filter(is_active=True).values('id','number','name')[:100]),
        'vehicles': list(Vehicle.objects.filter(is_active=True).values('id','plate_number','route_id','latitude','longitude')[:100]),
        'incidents': list(incidents.filter(status='ACTIVE').values('id','title','incident_type','latitude','longitude')[:100]),
        'requests': list(requests.exclude(status='DONE').values('id','request_type','status','latitude','longitude')[:100]),
    }

def safe_actions(actions, context):
    result = []
    if not isinstance(actions, list):
        return result
    for action in actions[:8]:
        if not isinstance(action, dict):
            continue
        kind = action.get('type')
        if kind in ('fly_to', 'show_cameras_near'):
            lat, lng = action.get('latitude'), action.get('longitude')
            if isinstance(lat,(int,float)) and isinstance(lng,(int,float)) and math.isfinite(lat) and math.isfinite(lng) and -90<=lat<=90 and -180<=lng<=180:
                result.append({'type':kind,'latitude':lat,'longitude':lng})
        elif kind in ('select_camera','select_parking','select_vehicle','show_route'):
            key = {'select_camera':'cameras','select_parking':'parkings','select_vehicle':'vehicles','show_route':'routes'}[kind]
            if any(item['id'] == action.get('id') for item in context[key]):
                result.append({'type':kind,'id':action['id']})
        elif kind == 'toggle_layer' and action.get('layer') in ('cameras','parkings','stops','vehicles','routes','incidents','requests','buildings','heatmap') and isinstance(action.get('enabled'),bool):
            result.append({'type':kind,'layer':action['layer'],'enabled':action['enabled']})
    return result
