from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import BusStop, ParkingLot, ParkingSpot, Route, RouteStop, Vehicle


class SmartCityAPITests(APITestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username='alice', password='test-pass-123')
        self.other = user_model.objects.create_user(username='bob', password='test-pass-123')
        self.admin = user_model.objects.create_user(username='admin', password='test-pass-123', is_staff=True)
        self.lot = ParkingLot.objects.create(
            name='Test parking', address='Test address', latitude='38.560000', longitude='68.780000'
        )
        self.spot = ParkingSpot.objects.create(parking=self.lot, number='A1')
        self.start = timezone.now() + timedelta(days=1)
        self.end = self.start + timedelta(hours=2)

    def authenticate(self, user):
        access = RefreshToken.for_user(user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    def booking_data(self):
        return {
            'parking_spot': self.spot.pk,
            'start_time': self.start.isoformat(),
            'end_time': self.end.isoformat(),
        }

    def test_account_and_protected_api(self):
        response = self.client.post('/account/register/', {'username': 'new-user', 'password': 'test-pass-123'})
        self.assertEqual(response.status_code, 201)
        response = self.client.post('/account/login/', {'username': 'new-user', 'password': 'test-pass-123'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        refresh = self.client.post('/account/token/refresh/', {'refresh': response.data['refresh']})
        self.assertEqual(refresh.status_code, 200)
        self.assertEqual(self.client.get('/api/parkings/').status_code, 401)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        self.assertEqual(self.client.get('/api/parkings/').data[0]['latitude'], '38.560000')
        response = self.client.patch('/account/profile/', {'first_name': 'New'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['first_name'], 'New')
        self.assertNotIn('password', response.data)

    def test_city_data_permissions_and_route_search(self):
        self.authenticate(self.user)
        self.assertEqual(self.client.post('/api/routes/', {'number': '1', 'name': 'Test route'}).status_code, 403)
        self.assertEqual(self.client.get('/api/parkings/').status_code, 200)

        self.authenticate(self.admin)
        route_response = self.client.post('/api/routes/', {'number': '1', 'name': 'Test route'}, format='json')
        self.assertEqual(route_response.status_code, 201)
        route_id = route_response.data['id']
        a = BusStop.objects.create(name='A', latitude='38.570000', longitude='68.770000')
        b = BusStop.objects.create(name='B', latitude='38.580000', longitude='68.780000')
        first = self.client.post('/api/route-stops/', {'route': route_id, 'stop': a.pk, 'order': 1})
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.data['stop_details']['latitude'], '38.570000')
        second = self.client.post('/api/route-stops/', {'route': route_id, 'stop': b.pk, 'order': 2})
        self.assertEqual(second.status_code, 201)
        duplicate = self.client.post('/api/route-stops/', {'route': route_id, 'stop': b.pk, 'order': 1})
        self.assertEqual(duplicate.status_code, 400)
        invalid_order = self.client.post('/api/route-stops/', {'route': route_id, 'stop': b.pk, 'order': 0})
        self.assertEqual(invalid_order.status_code, 400)

        self.authenticate(self.user)
        forward = self.client.get(f'/api/routes/search/{a.pk}/{b.pk}/')
        backward = self.client.get(f'/api/routes/search/{b.pk}/{a.pk}/')
        self.assertEqual(len(forward.data), 1)
        self.assertEqual(len(backward.data), 0)
        self.assertEqual(len(forward.data[0]['route_stops']), 2)

    def test_booking_validation_and_ownership(self):
        self.authenticate(self.user)
        response = self.client.post('/api/bookings/', self.booking_data())
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['user'], self.user.pk)
        booking_id = response.data['id']

        self.authenticate(self.other)
        self.assertEqual(len(self.client.get('/api/bookings/').data), 0)
        self.assertEqual(self.client.patch(f'/api/bookings/{booking_id}/', {'status': 'CANCELLED'}).status_code, 404)
        self.assertEqual(self.client.post('/api/bookings/', self.booking_data()).status_code, 400)
        availability = self.client.get(f'/api/parkings/{self.lot.pk}/availability/', {
            'start_time': self.start.isoformat(), 'end_time': self.end.isoformat(),
        })
        self.assertFalse(availability.data[0]['available'])
        adjacent = self.client.get(f'/api/parkings/{self.lot.pk}/availability/', {
            'start_time': self.end.isoformat(), 'end_time': (self.end + timedelta(hours=1)).isoformat(),
        })
        self.assertTrue(adjacent.data[0]['available'])

        self.authenticate(self.user)
        self.assertEqual(self.client.patch(f'/api/bookings/{booking_id}/', {'status': 'CANCELLED'}).status_code, 200)
        self.authenticate(self.other)
        self.assertEqual(self.client.post('/api/bookings/', self.booking_data()).status_code, 201)

        self.authenticate(self.admin)
        self.assertEqual(len(self.client.get('/api/bookings/').data), 2)

    def test_invalid_booking_times_and_inactive_spot(self):
        self.authenticate(self.user)
        data = self.booking_data()
        data['end_time'] = self.start.isoformat()
        self.assertEqual(self.client.post('/api/bookings/', data).status_code, 400)
        data = self.booking_data()
        data['start_time'] = (timezone.now() - timedelta(hours=1)).isoformat()
        self.assertEqual(self.client.post('/api/bookings/', data).status_code, 400)
        self.spot.is_active = False
        self.spot.save()
        self.assertEqual(self.client.post('/api/bookings/', self.booking_data()).status_code, 400)

    def test_incident_and_service_request_ownership(self):
        self.authenticate(self.user)
        incident = self.client.post('/api/incidents/', {
            'title': 'Test', 'description': 'Test incident', 'incident_type': 'OTHER',
            'latitude': '38.560000', 'longitude': '68.780000', 'created_by': self.other.pk,
        })
        self.assertEqual(incident.status_code, 201)
        self.assertEqual(incident.data['created_by'], self.user.pk)
        service = self.client.post('/api/service-requests/', {
            'request_type': 'ROAD', 'description': 'Test request',
            'latitude': '38.560000', 'longitude': '68.780000', 'user': self.other.pk,
        })
        self.assertEqual(service.status_code, 201)
        self.assertEqual(service.data['user'], self.user.pk)
        change = self.client.patch(f"/api/service-requests/{service.data['id']}/", {'status': 'DONE'})
        self.assertEqual(change.status_code, 400)

        self.authenticate(self.other)
        self.assertEqual(len(self.client.get('/api/incidents/').data), 0)
        self.assertEqual(len(self.client.get('/api/service-requests/').data), 0)
        self.assertEqual(self.client.get(f"/api/incidents/{incident.data['id']}/").status_code, 404)

        self.authenticate(self.admin)
        self.assertEqual(len(self.client.get('/api/incidents/').data), 1)
        self.assertEqual(len(self.client.get('/api/service-requests/').data), 1)
        change = self.client.patch(f"/api/service-requests/{service.data['id']}/", {'status': 'DONE'})
        self.assertEqual(change.status_code, 200)

    def test_vehicle_coordinates_and_admin_crud(self):
        self.authenticate(self.user)
        self.assertEqual(self.client.post('/api/vehicles/', {'plate_number': 'TEST-1'}).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/parkings/{self.lot.pk}/', {'name': 'Changed'}).status_code, 403)

        self.authenticate(self.admin)
        response = self.client.post('/api/vehicles/', {
            'plate_number': 'TEST-1', 'vehicle_type': 'BUS',
            'latitude': '38.560000', 'longitude': '68.780000',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        vehicle_id = response.data['id']
        response = self.client.patch(f'/api/vehicles/{vehicle_id}/', {'latitude': '38.570000'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['latitude'], '38.570000')
        self.assertEqual(self.client.delete(f'/api/vehicles/{vehicle_id}/').status_code, 204)
        self.assertEqual(self.client.patch(f'/api/parkings/{self.lot.pk}/', {'name': 'Changed'}).status_code, 200)

    def test_demo_seed_is_repeatable_and_bookable(self):
        call_command('seed_demo_data', verbosity=0)
        call_command('seed_demo_data', verbosity=0)
        route = Route.objects.get(number='88', name='DEMO Route 88')
        self.assertEqual(RouteStop.objects.filter(route=route).count(), 8)
        self.assertEqual(ParkingLot.objects.filter(name__startswith='DEMO').count(), 3)
        self.assertEqual(ParkingSpot.objects.filter(parking__name__startswith='DEMO').count(), 15)
        self.assertEqual(Vehicle.objects.filter(plate_number='DEMO-88-01').count(), 1)

        self.authenticate(self.user)
        self.assertEqual(len(self.client.get(f'/api/routes/{route.pk}/').data['route_stops']), 8)
        spot = ParkingSpot.objects.filter(parking__name='DEMO Parking West').first()
        data = self.booking_data()
        data['parking_spot'] = spot.pk
        self.assertEqual(self.client.post('/api/bookings/', data).status_code, 201)

    def test_swagger(self):
        self.assertEqual(self.client.get('/swagger/').status_code, 200)
        schema = self.client.get('/swagger/?format=openapi').json()
        paths = schema['paths']
        self.assertIn('/api/routes/search/{start_id}/{end_id}/', paths)
        self.assertIn('Bearer', schema['securityDefinitions'])
        self.assertTrue({'get', 'post'}.issubset(paths['/api/parkings/']))
        self.assertTrue({'get', 'put', 'patch', 'delete'}.issubset(paths['/api/parkings/{id}/']))

    def test_filters_and_missing_stop(self):
        self.authenticate(self.user)
        other_lot = ParkingLot.objects.create(name='Other', address='Other', latitude=38, longitude=68)
        ParkingSpot.objects.create(parking=other_lot, number='B1')
        spots = self.client.get(f'/api/parking-spots/?parking={self.lot.pk}')
        self.assertEqual([item['id'] for item in spots.data], [self.spot.pk])
        self.assertEqual(self.client.get('/api/parking-spots/?parking=invalid').status_code, 400)
        route = Route.objects.create(number='42', name='Test')
        vehicle = Vehicle.objects.create(route=route, plate_number='FILTER-42')
        Vehicle.objects.create(plate_number='NO-ROUTE')
        self.assertEqual([item['id'] for item in self.client.get(f'/api/vehicles/?route={route.pk}').data], [vehicle.pk])
        self.assertEqual(self.client.get('/api/routes/search/99999/99998/').status_code, 404)

    def test_route_stop_and_owned_crud(self):
        self.authenticate(self.admin)
        route = Route.objects.create(number='CRUD', name='CRUD')
        stop = BusStop.objects.create(name='CRUD', latitude=38, longitude=68)
        payload = {'route': route.pk, 'stop': stop.pk, 'order': 1}
        result = self.client.post('/api/route-stops/', payload)
        self.assertEqual(result.status_code, 201)
        url = f"/api/route-stops/{result.data['id']}/"
        self.assertEqual(self.client.get(url).status_code, 200)
        self.assertEqual(self.client.put(url, payload).status_code, 200)
        self.assertEqual(self.client.patch(url, {'order': 2}).status_code, 200)
        self.assertEqual(self.client.delete(url).status_code, 204)
        for resource, payload in [
            ('incidents', {'title': 'CRUD', 'description': 'Test', 'incident_type': 'OTHER', 'latitude': '38.560000', 'longitude': '68.780000'}),
            ('service-requests', {'description': 'Test', 'request_type': 'ROAD', 'latitude': '38.560000', 'longitude': '68.780000'}),
            ('bookings', self.booking_data()),
        ]:
            self.authenticate(self.user)
            result = self.client.post(f'/api/{resource}/', payload)
            self.assertEqual(result.status_code, 201)
            url = f"/api/{resource}/{result.data['id']}/"
            self.assertEqual(self.client.put(url, payload).status_code, 200)
            self.authenticate(self.other)
            self.assertEqual(self.client.get(url).status_code, 404)
            self.assertEqual(self.client.delete(url).status_code, 404)
            self.authenticate(self.admin)
            self.assertEqual(self.client.get(url).status_code, 200)
            self.authenticate(self.user)
            self.assertEqual(self.client.delete(url).status_code, 204)

    def test_all_city_crud_methods(self):
        resources = [
            ('parkings', {'name': 'CRUD', 'address': 'Test', 'latitude': '38.560000', 'longitude': '68.780000'}),
            ('parking-spots', {'parking': self.lot.pk, 'number': 'CRUD'}),
            ('stops', {'name': 'CRUD', 'latitude': '38.560000', 'longitude': '68.780000'}),
            ('routes', {'number': 'CRUD', 'name': 'CRUD'}),
            ('vehicles', {'plate_number': 'CRUD'}),
        ]
        for resource, payload in resources:
            with self.subTest(resource=resource):
                self.client.credentials()
                self.assertEqual(self.client.get(f'/api/{resource}/').status_code, 401)
                self.authenticate(self.user)
                self.assertEqual(self.client.get(f'/api/{resource}/').status_code, 200)
                self.assertEqual(self.client.post(f'/api/{resource}/', payload).status_code, 403)
                self.authenticate(self.admin)
                result = self.client.post(f'/api/{resource}/', payload)
                self.assertEqual(result.status_code, 201)
                url = f"/api/{resource}/{result.data['id']}/"
                self.assertEqual(self.client.get(url).status_code, 200)
                self.assertEqual(self.client.put(url, payload).status_code, 200)
                self.assertEqual(self.client.patch(url, payload).status_code, 200)
                self.assertEqual(self.client.delete(url).status_code, 204)

    def test_booking_patch_excludes_itself_and_inactive_lot(self):
        self.authenticate(self.user)
        result = self.client.post('/api/bookings/', self.booking_data())
        url = f"/api/bookings/{result.data['id']}/"
        self.assertEqual(self.client.patch(url, self.booking_data()).status_code, 200)
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.lot.is_active = False
        self.lot.save()
        self.assertEqual(self.client.post('/api/bookings/', self.booking_data()).status_code, 400)

    def test_ai_not_configured_and_input_validation(self):
        from unittest.mock import patch
        self.assertEqual(self.client.post('/api/assistant/', {'message': 'Hello'}).status_code, 401)
        self.authenticate(self.user)
        with patch.dict('os.environ', {}, clear=True):
            result = self.client.post('/api/assistant/', {'message': 'Hello'})
            self.assertEqual(result.status_code, 503)
            self.assertEqual(str(result.data['detail']), 'AI is not configured.')
            self.assertEqual(self.client.post('/api/camera/analyze/', {'image': 'data:image/jpeg;base64,/9j/'}).status_code, 503)
        self.assertEqual(self.client.post('/api/assistant/', {}).status_code, 400)
        self.assertEqual(self.client.post('/api/camera/analyze/', {'image': 'invalid'}).status_code, 400)
