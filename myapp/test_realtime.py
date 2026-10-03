from datetime import timedelta
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from core.asgi import application
from .models import ParkingLot, ParkingSpot, ParkingBooking, Route, BusStop, RouteStop, Vehicle, TrafficIncident, RouteGeometry
from .tasks import check_expired_bookings, move_demo_vehicle


class BackgroundTaskTests(TransactionTestCase):
    def test_expired_bookings_and_repeat_execution(self):
        user = get_user_model().objects.create_user(username='tasks')
        lot = ParkingLot.objects.create(name='Task', address='Task', latitude=38, longitude=68)
        spot = ParkingSpot.objects.create(parking=lot, number='A1')
        now = timezone.now()
        old = ParkingBooking.objects.create(user=user, parking_spot=spot,
            start_time=now-timedelta(hours=2), end_time=now-timedelta(hours=1))
        future = ParkingBooking.objects.create(user=user, parking_spot=spot,
            start_time=now, end_time=now+timedelta(hours=1))
        cancelled = ParkingBooking.objects.create(user=user, parking_spot=spot,
            start_time=now-timedelta(hours=2), end_time=now-timedelta(hours=1), status='CANCELLED')
        self.assertEqual(check_expired_bookings.run(), 1)
        self.assertEqual(check_expired_bookings.run(), 0)
        for record in (old, future, cancelled):
            record.refresh_from_db()
        self.assertEqual((old.status, future.status, cancelled.status), ('COMPLETED', 'BOOKED', 'CANCELLED'))

    def test_demo_moves_only_named_vehicle_along_road_geometry(self):
        route = Route.objects.create(number='88', name='DEMO Route 88')
        stops = [BusStop.objects.create(name=str(i), latitude=38+i/100, longitude=68) for i in range(2)]
        for stop in stops:
            stop.refresh_from_db()
        for i, stop in enumerate(stops, 1):
            RouteStop.objects.create(route=route, stop=stop, order=i)
        demo = Vehicle.objects.create(route=route, plate_number='DEMO-88-01', latitude=stops[0].latitude, longitude=68)
        real = Vehicle.objects.create(route=route, plate_number='REAL', latitude=38, longitude=68)
        RouteGeometry.objects.create(route=route,stop_signature='test',geometry={'type':'LineString','coordinates':[[68,38],[68.001,38],[68.001,38.01]]},distance_m=1200,duration_s=150)
        self.assertTrue(move_demo_vehicle.run())
        demo.refresh_from_db(); real.refresh_from_db()
        self.assertEqual(float(demo.latitude),38)
        self.assertGreater(float(demo.longitude),68)
        self.assertLess(float(demo.longitude),68.001)
        self.assertEqual(real.latitude, 38)
        self.assertTrue(move_demo_vehicle.run())
        demo.refresh_from_db()
        self.assertGreater(float(demo.latitude),38)
        self.assertEqual(float(demo.longitude),68.001)


@override_settings(REALTIME_ENABLED=True,
    CHANNEL_LAYERS={'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}})
class WebSocketTests(TransactionTestCase):
    def setUp(self):
        model = get_user_model()
        self.owner = model.objects.create_user(username='owner')
        self.other = model.objects.create_user(username='other')
        self.staff = model.objects.create_user(username='staff', is_staff=True)

    async def websocket(self, user):
        ws = WebsocketCommunicator(application, '/ws/city/',
            headers=[(b'origin', b'http://localhost:5173')])
        self.assertTrue((await ws.connect())[0])
        token = await database_sync_to_async(lambda: str(RefreshToken.for_user(user).access_token))()
        await ws.send_json_to({'type': 'authenticate', 'access': token})
        self.assertEqual(await ws.receive_json_from(), {'kind': 'connected'})
        return ws

    def test_jwt_and_private_signal_delivery(self):
        async def scenario():
            owner, other, staff = await self.websocket(self.owner), await self.websocket(self.other), await self.websocket(self.staff)
            try:
                await database_sync_to_async(TrafficIncident.objects.create)(
                    created_by=self.owner, title='Private', description='Private',
                    incident_type='OTHER', latitude=38, longitude=68)
                self.assertEqual((await owner.receive_json_from())['kind'], 'incident.created')
                self.assertEqual((await staff.receive_json_from())['kind'], 'incident.created')
                self.assertTrue(await other.receive_nothing(timeout=0.1))
            finally:
                await owner.disconnect(); await other.disconnect(); await staff.disconnect()
        async_to_sync(scenario)()

    def test_invalid_jwt_origin_and_write_attempt(self):
        async def scenario():
            forbidden = WebsocketCommunicator(application, '/ws/city/', headers=[(b'origin', b'https://untrusted.invalid')])
            self.assertFalse((await forbidden.connect())[0])
            await forbidden.disconnect()
            bad = WebsocketCommunicator(application, '/ws/city/', headers=[(b'origin', b'http://localhost:5173')])
            await bad.connect()
            await bad.send_json_to({'type': 'authenticate', 'access': 'invalid'})
            self.assertEqual((await bad.receive_output())['code'], 4401)
            await bad.disconnect()
            valid = await self.websocket(self.owner)
            await valid.send_json_to({'type': 'move_vehicle', 'id': 1})
            self.assertEqual((await valid.receive_output())['code'], 4403)
            await valid.disconnect()
        async_to_sync(scenario)()
