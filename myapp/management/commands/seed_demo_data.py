from django.core.management.base import BaseCommand
from django.db import transaction

from myapp.models import BusStop, ParkingLot, ParkingSpot, Route, RouteStop, Vehicle


# DEMO DATA: these points illustrate the interface and are not official stops.
DEMO_STOPS = [
    ('DEMO 88 · Остановка 1', '38.581810', '68.721580'),
    ('DEMO 88 · Остановка 2', '38.580200', '68.733100'),
    ('DEMO 88 · Остановка 3', '38.577400', '68.745800'),
    ('DEMO 88 · Остановка 4', '38.575100', '68.758600'),
    ('DEMO 88 · Остановка 5', '38.572900', '68.771400'),
    ('DEMO 88 · Остановка 6', '38.568700', '68.783900'),
    ('DEMO 88 · Остановка 7', '38.560900', '68.798200'),
    ('DEMO 88 · Остановка 8', '38.550440', '68.814980'),
]

DEMO_PARKINGS = [
    ('DEMO Parking West', '38.580900', '68.729400'),
    ('DEMO Parking Center', '38.572300', '68.780100'),
    ('DEMO Parking East', '38.557700', '68.806200'),
]


class Command(BaseCommand):
    help = 'Create repeatable DEMO Route 88, vehicle and bookable parking spots.'

    @transaction.atomic
    def handle(self, *args, **options):
        route, _ = Route.objects.get_or_create(
            number='88', name='DEMO Route 88', defaults={'is_active': True}
        )
        for order, (name, latitude, longitude) in enumerate(DEMO_STOPS, start=1):
            stop, _ = BusStop.objects.get_or_create(
                name=name,
                defaults={
                    'address': 'DEMO DATA · Душанбе',
                    'latitude': latitude,
                    'longitude': longitude,
                },
            )
            RouteStop.objects.get_or_create(route=route, stop=stop, defaults={'order': order})

        Vehicle.objects.get_or_create(
            plate_number='DEMO-88-01',
            defaults={
                'route': route,
                'vehicle_type': 'MINIBUS',
                'latitude': DEMO_STOPS[0][1],
                'longitude': DEMO_STOPS[0][2],
            },
        )

        for name, latitude, longitude in DEMO_PARKINGS:
            parking, _ = ParkingLot.objects.get_or_create(
                name=name,
                defaults={
                    'address': 'DEMO DATA · Душанбе',
                    'latitude': latitude,
                    'longitude': longitude,
                    'is_active': True,
                },
            )
            for number in range(1, 6):
                ParkingSpot.objects.get_or_create(
                    parking=parking,
                    number=f'A{number}',
                    defaults={'spot_type': 'NORMAL', 'is_active': True},
                )

        self.stdout.write(self.style.SUCCESS('DEMO DATA ready: Route 88, 8 stops, 1 vehicle, 3 parkings, 15 spots.'))
