import json
from io import BytesIO
from unittest.mock import patch
from urllib.error import URLError
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from .models import Camera, CameraAlert, Route, BusStop, RouteStop, RouteGeometry, TrafficIncident
from .road_routing import road_geometry, RoutingUnavailable
from .camera_media import media_ticket, read_ticket, proxy_playlist, validate_camera_url
from .assistant_context import city_context, safe_actions
from email.message import Message
from django.utils import timezone
from datetime import timedelta
from .models import ParkingLot,ParkingSpot,ParkingBooking

class RoadRoutingTests(TestCase):
    def setUp(self):
        self.route=Route.objects.create(number='4',name='Test')
        for order,lat in enumerate([38.56,38.57],1):
            stop=BusStop.objects.create(name=str(order),latitude=lat,longitude=68.78)
            RouteStop.objects.create(route=self.route,stop=stop,order=order)

    def provider(self):
        return BytesIO(json.dumps({'code':'Ok','routes':[{'geometry':{'type':'LineString','coordinates':[[68.78,38.56],[68.779,38.563],[68.78,38.57]]},'distance':1300,'duration':180}], 'waypoints':[{'distance':4},{'distance':7}]}).encode())

    @patch('myapp.road_routing.urlopen')
    def test_road_shape_persisted_and_invalidated_after_stop_edit(self, provider):
        provider.side_effect=lambda *a,**kw:self.provider()
        result=road_geometry(self.route)
        self.assertEqual(len(result.geometry['coordinates']),3)
        self.assertEqual(road_geometry(self.route).pk,result.pk)
        self.assertEqual(provider.call_count,1)
        stop=self.route.route_stops.first().stop
        stop.latitude=38.559;stop.save()
        road_geometry(self.route)
        self.assertEqual(provider.call_count,2)
        self.assertEqual(RouteGeometry.objects.count(),1)

    @patch('myapp.road_routing.urlopen',side_effect=URLError('offline'))
    def test_no_straight_fallback_on_provider_failure(self, provider):
        with self.assertRaises(RoutingUnavailable):road_geometry(self.route)
        self.assertFalse(RouteGeometry.objects.exists())

    @patch('myapp.road_routing.urlopen')
    def test_rejects_distant_waypoints(self, provider):
        data=json.loads(self.provider().read());data['waypoints'][0]['distance']=300
        provider.return_value=BytesIO(json.dumps(data).encode())
        with self.assertRaises(RoutingUnavailable):road_geometry(self.route)

@override_settings(CAMERA_ALLOWED_HOSTS=['camera.example'],CAMERA_ALLOW_PRIVATE=True)
class CameraTests(TestCase):
    def setUp(self):
        users=get_user_model()
        self.user=users.objects.create_user(username='viewer')
        self.staff=users.objects.create_user(username='operator',is_staff=True)
        self.camera=Camera.objects.create(name='Test camera',latitude=38.56,longitude=68.78,rights_confirmed=True,stream_url='https://camera.example/live/index.m3u8',stream_type='HLS')
        self.client=APIClient();self.client.force_authenticate(self.user)

    def test_permissions_geojson_nearby_and_no_stream_credentials(self):
        self.assertEqual(self.client.post('/api/cameras/',{},format='json').status_code,403)
        response=self.client.get('/api/cameras/')
        self.assertNotIn('stream_url',response.data[0])
        self.assertEqual(self.client.get('/api/cameras/map/').data['features'][0]['geometry']['coordinates'],[68.78,38.56])
        self.assertEqual(len(self.client.get('/api/cameras/nearby/?lat=38.56&lng=68.78').data),1)
        self.assertEqual(self.client.get('/api/cameras/nearby/?lat=nan&lng=68').status_code,400)
        Camera.objects.create(name='Private',latitude=38,longitude=68,rights_confirmed=False,is_active=False)
        self.assertEqual(len(self.client.get('/api/cameras/').data),1)

    def test_scoped_ticket_revocation_and_playlist_rewrite(self):
        token=media_ticket(self.camera,self.user,self.camera.stream_url)
        user,url=read_ticket(token,self.camera)
        self.assertEqual(user.pk,self.user.pk)
        self.assertEqual(url,self.camera.stream_url)
        playlist=proxy_playlist('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\nsegment.ts\n',url,self.camera,user)
        self.assertNotIn('camera.example',playlist)
        self.assertEqual(playlist.count('/api/cameras/'),2)
        self.camera.is_active=False;self.camera.save()
        with self.assertRaises(Exception):read_ticket(token,self.camera)

    def test_url_allowlist_credentials_and_rights(self):
        with self.assertRaises(ValidationError):validate_camera_url('https://camera.example:99999/image.jpg')
        with self.assertRaises(ValidationError):validate_camera_url('https://other.example/image.jpg')
        with self.assertRaises(ValidationError):validate_camera_url('https://admin:secret@camera.example/image.jpg')
        self.client.force_authenticate(self.staff)
        response=self.client.post('/api/cameras/',{'name':'new','latitude':38,'longitude':68,'rights_confirmed':False},format='json')
        self.assertEqual(response.status_code,400)

    def test_ai_alert_requires_human_review_once(self):
        alert=CameraAlert.objects.create(camera=self.camera,requested_by=self.staff,status='REVIEW',answer='Possible event')
        self.assertEqual(self.client.post(f'/api/ai-alerts/{alert.pk}/review/',{'action':'confirm'},format='json').status_code,403)
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.post(f'/api/ai-alerts/{alert.pk}/review/',{'action':'confirm'},format='json').status_code,200)
        self.assertEqual(self.client.post(f'/api/ai-alerts/{alert.pk}/review/',{'action':'confirm'},format='json').status_code,400)
        self.assertEqual(TrafficIncident.objects.count(),1)

    def test_ai_context_is_scoped_and_actions_validated(self):
        TrafficIncident.objects.create(created_by=self.staff,title='Private',description='Private',incident_type='OTHER',latitude=38,longitude=68)
        context=city_context(self.user)
        self.assertEqual(context['incidents'],[])
        self.assertNotIn('stream_url',str(context))
        result=safe_actions([{'type':'select_camera','id':self.camera.pk},{'type':'select_camera','id':9000},{'type':'delete_database'},{'type':'fly_to','latitude':float('nan'),'longitude':68}],context)
        self.assertEqual(result,[{'type':'select_camera','id':self.camera.pk}])

    def test_health_and_optional_provider_states(self):
        self.assertEqual(self.client.get('/api/system/status/').status_code,200)
        self.assertEqual(self.client.get('/api/layers/weather/').status_code,503)

    @patch('myapp.cameras.open_camera')
    def test_hls_proxy_rewrites_segments_and_requires_media_ticket(self, upstream):
        stream=BytesIO(b'#EXTM3U\n#EXTINF:1,\nsegment.ts\n')
        stream.headers=Message();stream.headers['Content-Type']='application/vnd.apple.mpegurl'
        upstream.return_value=stream
        access=self.client.post(f'/api/cameras/{self.camera.pk}/access/').data
        anonymous=APIClient()
        self.assertEqual(anonymous.get(f'/api/cameras/{self.camera.pk}/stream/').status_code,403)
        response=anonymous.get(access['url'])
        self.assertEqual(response.status_code,200)
        self.assertNotIn(b'camera.example',response.content)
        self.assertIn(b'ticket=',response.content)

    @patch('myapp.cameras.open_camera')
    def test_webrtc_whep_offer_answer_and_session_ownership(self, upstream):
        self.camera.stream_type='WEBRTC';self.camera.save()
        stream=BytesIO(b'v=0\r\ns=Test\r\n')
        stream.url='https://camera.example/whep'
        stream.headers=Message();stream.headers['Location']='/sessions/1'
        upstream.return_value=stream
        response=self.client.post(f'/api/cameras/{self.camera.pk}/whep/',{'sdp':'v=0\r\ns=Offer\r\n'},format='json')
        self.assertEqual(response.status_code,201)
        self.assertNotIn('camera.example',str(response.data))
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.delete(f'/api/cameras/{self.camera.pk}/whep/',{'resource':response.data['resource']},format='json').status_code,403)

    @patch('myapp.cameras.open_camera')
    def test_mjpeg_is_async_streaming_for_asgi(self, upstream):
        self.camera.stream_type='MJPEG';self.camera.stream_url='https://camera.example/mjpeg';self.camera.save()
        stream=BytesIO(b'--frame\r\nContent-Type: image/jpeg\r\n\r\nTEST\r\n')
        stream.headers=Message();stream.headers['Content-Type']='multipart/x-mixed-replace; boundary=frame'
        upstream.return_value=stream
        url=self.client.post(f'/api/cameras/{self.camera.pk}/access/').data['url']
        response=APIClient().get(url)
        self.assertTrue(response.streaming)
        self.assertTrue(response.is_async)
        from asgiref.sync import async_to_sync
        async def consume():
            return b''.join([chunk async for chunk in response.streaming_content])
        self.assertIn(b'Content-Type: image/jpeg',async_to_sync(consume)())

    def test_free_parking_count_does_not_reveal_other_users_bookings(self):
        lot=ParkingLot.objects.create(name='Lot',address='Lot',latitude=38,longitude=68)
        free=ParkingSpot.objects.create(parking=lot,number='1')
        busy=ParkingSpot.objects.create(parking=lot,number='2')
        now=timezone.now()
        ParkingBooking.objects.create(user=self.staff,parking_spot=busy,start_time=now-timedelta(hours=1),end_time=now+timedelta(hours=1))
        item=self.client.get('/api/parkings/').data[0]
        self.assertEqual((item['total_spots'],item['free_spots']),(2,1))
        self.assertEqual(len(self.client.get('/api/bookings/').data),0)
