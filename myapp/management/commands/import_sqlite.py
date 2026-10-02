"""Copy existing users and Smart City models without JSON files or deleting SQLite."""
import sqlite3
from pathlib import Path
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connection, transaction
from myapp.models import ParkingLot, ParkingSpot, ParkingBooking, BusStop, Route, RouteStop, Vehicle, TrafficIncident, ServiceRequest


class Command(BaseCommand):
    help = 'Import existing users and city records into an EMPTY PostgreSQL database.'

    def add_arguments(self, parser):
        parser.add_argument('--source', default=str(settings.BASE_DIR / 'db.sqlite3'))

    @transaction.atomic
    def handle(self, *args, **options):
        models = [get_user_model(), ParkingLot, ParkingSpot, BusStop, Route,
                  RouteStop, Vehicle, ParkingBooking, TrafficIncident, ServiceRequest]
        if connection.vendor != 'postgresql':
            raise CommandError('Target must be PostgreSQL')
        if any(model.objects.exists() for model in models):
            raise CommandError('Target contains data; refusing to merge or overwrite')
        path = Path(options['source']).resolve()
        if not path.is_file():
            raise CommandError('SQLite source file not found')
        with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as source:
            source.row_factory = sqlite3.Row
            for model in models:
                rows = source.execute(f'SELECT * FROM "{model._meta.db_table}"').fetchall()
                objects = [model(**{field.attname: field.to_python(row[field.column])
                                   for field in model._meta.concrete_fields}) for row in rows]
                model.objects.bulk_create(objects)
                self.stdout.write(f'{model.__name__}: {len(objects)}')
        with connection.cursor() as cursor:
            for statement in connection.ops.sequence_reset_sql(no_style(), models):
                cursor.execute(statement)
        self.stdout.write('Imported users and city data. SQLite was kept unchanged. Custom groups, sessions and token blacklist were not copied; log in again.')
