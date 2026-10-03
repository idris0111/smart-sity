"""Road geometry from ordered DB stops, never a straight-line fallback."""
import hashlib
import json
import math
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen

from django.conf import settings
from rest_framework.exceptions import APIException, ValidationError
from .models import RouteGeometry


class RoutingUnavailable(APIException):
    status_code = 503
    default_detail = 'Road routing unavailable. No straight-line substitute is displayed.'


def road_geometry(route, refresh=False):
    stops = list(route.route_stops.select_related('stop').order_by('order'))
    if not 2 <= len(stops) <= 100:
        raise ValidationError('A road route needs between 2 and 100 ordered stops.')
    points = [[float(item.stop.longitude), float(item.stop.latitude)] for item in stops]
    signature = hashlib.sha256(json.dumps(points).encode()).hexdigest()
    cached = RouteGeometry.objects.filter(route=route, stop_signature=signature).first()
    if cached and not refresh:
        return cached
    coordinates = ';'.join(f'{lng:.6f},{lat:.6f}' for lng, lat in points)
    query = urlencode({'overview': 'full', 'geometries': 'geojson', 'steps': 'false',
                       'radiuses': ';'.join(['150'] * len(points))})
    url = f'{settings.ROUTING_URL.rstrip("/")}/route/v1/driving/{coordinates}?{query}'
    try:
        with urlopen(url, timeout=15) as response:
            payload = json.loads(response.read(5 * 1024 * 1024))
        if payload.get('code') != 'Ok' or not payload.get('routes'):
            raise ValueError('No road route found')
        result = payload['routes'][0]
        geometry = result['geometry']
        positions = geometry['coordinates']
        if geometry.get('type') != 'LineString' or len(positions) < 2:
            raise ValueError('Invalid geometry')
        if any(len(p) != 2 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in p)
               or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90) for p in positions):
            raise ValueError('Invalid position')
        waypoints = payload['waypoints']
        if len(waypoints) != len(stops) or any(p.get('distance', 1000) > 150 for p in waypoints):
            raise ValueError('Stop too far from road')
        distance, duration = float(result['distance']), float(result['duration'])
        if not math.isfinite(distance) or not math.isfinite(duration) or distance <= 0 or duration < 0:
            raise ValueError('Invalid route summary')
    except (URLError, TimeoutError, OSError, ValueError, KeyError, IndexError, TypeError):
        raise RoutingUnavailable() from None
    geometry, _ = RouteGeometry.objects.update_or_create(route=route, defaults={
        'stop_signature': signature, 'geometry': geometry, 'waypoints': waypoints,
        'distance_m': distance, 'duration_s': duration,
    })
    return geometry


def geometry_payload(route, result):
    return {'route_id': route.pk, 'number': route.number, 'is_demo': route.name.startswith('DEMO'),
            'geometry': result.geometry, 'coordinates': [[lat, lng] for lng, lat in result.geometry['coordinates']],
            'waypoints': result.waypoints, 'distance_m': result.distance_m,
            'duration_s': result.duration_s, 'source': result.source, 'updated_at': result.updated_at}
