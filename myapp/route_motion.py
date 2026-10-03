"""Distance-based movement along the stored road polyline, only for DEMO."""
import math

def segment_length(a, b):
    lat1, lat2 = math.radians(a[1]), math.radians(b[1])
    value = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(math.radians(b[0]-a[0])/2)**2
    return 6371000*2*math.asin(min(1,math.sqrt(value)))

def position_at(coordinates, distance):
    segments = [segment_length(a,b) for a,b in zip(coordinates,coordinates[1:])]
    total = sum(segments)
    if total <= 0:
        raise ValueError('Empty road geometry')
    progress = distance % total
    remaining = progress
    for a,b,length in zip(coordinates,coordinates[1:],segments):
        if length and remaining <= length:
            ratio=remaining/length
            return [a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio],progress
        remaining-=length
    return coordinates[-1],progress
