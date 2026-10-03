"""Optional spatial preparation; decimal coordinates and existing APIs stay intact."""
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from myapp.models import Camera, ParkingLot, BusStop, Vehicle, TrafficIncident, ServiceRequest

class Command(BaseCommand):
    help = 'Add generated WGS84 point columns and GiST indexes when PostGIS is installed.'

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            raise CommandError('PostGIS requires PostgreSQL.')
        with connection.cursor() as cursor:
            cursor.execute("SELECT name FROM pg_available_extensions WHERE name='postgis'")
            if not cursor.fetchone():
                raise CommandError('PostGIS is not installed in this PostgreSQL server. Existing coordinates remain available.')
        quote = connection.ops.quote_name
        with transaction.atomic(), connection.cursor() as cursor:
            cursor.execute('CREATE EXTENSION IF NOT EXISTS postgis')
            for model in (Camera, ParkingLot, BusStop, Vehicle, TrafficIncident, ServiceRequest):
                table = model._meta.db_table
                cursor.execute(f'ALTER TABLE {quote(table)} ADD COLUMN IF NOT EXISTS geo_point geometry(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude::double precision,latitude::double precision),4326)) STORED')
                cursor.execute(f'CREATE INDEX IF NOT EXISTS {quote(table+"_geo_gist")} ON {quote(table)} USING GIST (geo_point)')
        self.stdout.write(self.style.SUCCESS('WGS84 points and GiST indexes ready. Existing data and REST fields preserved.'))
