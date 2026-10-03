import time
import math
import asyncio
import re
from urllib.error import URLError
from urllib.parse import urljoin, urlsplit

from django.http import HttpResponse, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateDestroyAPIView, GenericAPIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Camera, CameraAlert, TrafficIncident
from .permissions import IsAdminOrReadOnly
from .camera_media import validate_camera_url, media_ticket, read_ticket, open_camera, proxy_playlist, snapshot

class CameraUnavailable(APIException):
    status_code = 503
    default_detail = 'Camera service unavailable.'


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = '__all__'
        extra_kwargs = {'stream_url': {'write_only': True}, 'preview_url': {'write_only': True}}
        read_only_fields = ['status', 'last_seen', 'latency_ms', 'created_at', 'updated_at']

    def validate(self, attrs):
        for field, limit in [('latitude', 90), ('longitude', 180)]:
            if field in attrs and abs(attrs[field]) > limit:
                raise ValidationError({field: 'Coordinate out of range.'})
        for field in ('stream_url', 'preview_url'):
            if attrs.get(field):
                try:
                    validate_camera_url(attrs[field])
                except ValidationError as error:
                    raise ValidationError({field: error.detail})
        active = attrs.get('is_active', getattr(self.instance, 'is_active', True))
        rights = attrs.get('rights_confirmed', getattr(self.instance, 'rights_confirmed', False))
        if active and not rights:
            raise ValidationError({'rights_confirmed': 'Confirm permission to use this camera stream.'})
        return attrs


class CameraListView(ListCreateAPIView):
    serializer_class = CameraSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Camera.objects.all().order_by('id')
        if not self.request.user.is_staff:
            qs = qs.filter(is_active=True, rights_confirmed=True)
        return qs


class CameraDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = CameraSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Camera.objects.all()
        return qs if self.request.user.is_staff else qs.filter(is_active=True, rights_confirmed=True)


class CameraMapView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({'type': 'FeatureCollection', 'features': [
            {'type': 'Feature', 'id': camera.pk,
             'geometry': {'type': 'Point', 'coordinates': [float(camera.longitude), float(camera.latitude)]},
             'properties': {'id': camera.pk, 'kind': 'camera', 'name': camera.name,
                            'status': camera.status, 'stream_type': camera.stream_type}}
            for camera in Camera.objects.filter(is_active=True, rights_confirmed=True)]})


class CameraNearbyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            lat, lng = float(request.query_params['lat']), float(request.query_params['lng'])
            radius = float(request.query_params.get('radius_m', 1000))
            if not -90 < lat < 90 or not -180 <= lng <= 180 or not 0 < radius <= 25000:
                raise ValueError()
        except (ValueError, KeyError):
            raise ValidationError('Use lat, lng and radius_m between 1 and 25000.')
        delta = radius / 111320
        longitude_delta = delta / max(math.cos(math.radians(lat)), 0.01)
        qs = Camera.objects.filter(is_active=True, rights_confirmed=True,
                                   latitude__range=(lat - delta, lat + delta),
                                   longitude__range=(lng - longitude_delta, lng + longitude_delta))
        records = []
        for camera in qs:
            a = math.sin(math.radians(float(camera.latitude) - lat) / 2) ** 2 + math.cos(math.radians(lat)) * math.cos(math.radians(float(camera.latitude))) * math.sin(math.radians(float(camera.longitude) - lng) / 2) ** 2
            distance = 6371000 * 2 * math.asin(min(1, math.sqrt(a)))
            if distance <= radius:
                records.append({**CameraSerializer(camera).data, 'distance_m': round(distance)})
        return Response(sorted(records, key=lambda row: row['distance_m'])[:100])


class CameraStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        camera = get_object_or_404(Camera, pk=pk, is_active=True, rights_confirmed=True)
        return Response({'status': camera.status, 'last_seen': camera.last_seen, 'latency_ms': camera.latency_ms})


class CameraAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        camera = get_object_or_404(Camera, pk=pk, is_active=True, rights_confirmed=True)
        url = camera.stream_url or camera.preview_url
        if not url:
            raise ValidationError('Stream unavailable. No URL configured.')
        validate_camera_url(url)
        if camera.stream_type == 'WEBRTC':
            return Response({'stream_type': 'WEBRTC', 'url': f'/api/cameras/{pk}/whep/', 'expires_in': 300})
        if camera.stream_type == 'EXTERNAL':
            # External means an explicitly public embed URL; secret-bearing URLs stay proxied.
            if urlsplit(url).query or urlsplit(url).fragment:
                raise ValidationError('External embeds must use a public URL without query credentials. Use a streaming gateway otherwise.')
            return Response({'stream_type': 'EXTERNAL', 'url': url, 'expires_in': 300})
        return Response({'stream_type': camera.stream_type,
                         'url': f'/api/cameras/{pk}/stream/?ticket={media_ticket(camera, request.user, url)}',
                         'expires_in': 300})


class CameraStreamView(APIView):
    permission_classes = [AllowAny]  # This endpoint uses a scoped, encrypted, expiring media ticket.
    authentication_classes = []

    def get(self, request, pk):
        camera = get_object_or_404(Camera, pk=pk)
        user, url = read_ticket(request.query_params.get('ticket', ''), camera)
        try:
            headers = {}
            byte_range = request.headers.get('Range', '')
            if byte_range and re.fullmatch(r'bytes=\d+-\d*', byte_range):
                headers['Range'] = byte_range
            upstream = open_camera(url, headers=headers)
            content_type = upstream.headers.get_content_type()
            if 'mpegurl' in content_type or url.split('?', 1)[0].endswith('.m3u8'):
                with upstream:
                    content = upstream.read(2 * 1024 * 1024 + 1)
                if len(content) > 2 * 1024 * 1024:
                    raise ValueError()
                response = HttpResponse(proxy_playlist(content.decode(), url, camera, user), content_type='application/vnd.apple.mpegurl')
            else:
                allowed = ('image/jpeg','image/png','video/mp2t','video/mp4','video/iso.segment',
                           'audio/aac','audio/mpeg','application/octet-stream','multipart/x-mixed-replace')
                if content_type not in allowed:
                    upstream.close()
                    raise ValueError('Unsupported media type')
                # Bounded connection lifetime; the viewer renews its scoped access.
                async def chunks():
                    deadline = time.monotonic() + 240
                    try:
                        while time.monotonic() < deadline:
                            chunk = await asyncio.to_thread(getattr(upstream, 'read1', upstream.read), 65536)
                            if not chunk:
                                break
                            yield chunk
                    finally:
                        upstream.close()
                response = StreamingHttpResponse(chunks(), content_type=upstream.headers.get('Content-Type', 'application/octet-stream'), status=getattr(upstream, 'status', 200))
                for header in ('Content-Range', 'Accept-Ranges'):
                    if upstream.headers.get(header):
                        response[header] = upstream.headers[header]
            response['Cache-Control'] = 'private, no-store'
            response['X-Content-Type-Options'] = 'nosniff'
            return response
        except (OSError, URLError, ValueError, UnicodeError):
            raise CameraUnavailable('Camera stream unavailable.') from None

class CameraWHEPView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        camera = get_object_or_404(Camera, pk=pk, is_active=True, rights_confirmed=True, stream_type='WEBRTC')
        sdp = request.data.get('sdp')
        if not isinstance(sdp, str) or not sdp.startswith('v=0') or len(sdp) > 64000:
            raise ValidationError('A valid SDP offer is required.')
        try:
            with open_camera(camera.stream_url, method='POST', data=sdp.encode(), headers={'Content-Type':'application/sdp'}) as upstream:
                answer = upstream.read(64001).decode()
                resource = urljoin(upstream.url, upstream.headers.get('Location',''))
                if len(answer)>64000 or not answer.startswith('v=0') or not upstream.headers.get('Location'):
                    raise ValueError()
                validate_camera_url(resource)
            return Response({'sdp':answer,'resource':media_ticket(camera,request.user,resource)},status=201)
        except (OSError,URLError,ValueError,UnicodeError):
            raise CameraUnavailable('WebRTC gateway unavailable.') from None

    def delete(self, request, pk):
        camera = get_object_or_404(Camera,pk=pk,is_active=True,rights_confirmed=True,stream_type='WEBRTC')
        user,resource = read_ticket(request.data.get('resource',''),camera)
        if user.pk != request.user.pk:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        try:
            with open_camera(resource,method='DELETE'):
                pass
        except (OSError,URLError):
            raise CameraUnavailable('WebRTC session release unavailable.') from None
        return Response(status=204)


class CameraSnapshotView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        camera = get_object_or_404(Camera, pk=pk, is_active=True, rights_confirmed=True)
        try:
            data, content_type = snapshot(camera)
        except (OSError, URLError):
            raise CameraUnavailable('Camera snapshot unavailable.') from None
        response = HttpResponse(data, content_type=content_type)
        response['Cache-Control'] = 'private, no-store'
        return response


class CameraAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = CameraAlert
        fields = '__all__'
        read_only_fields = ['status', 'answer', 'confidence', 'error', 'requested_by', 'incident']


class CameraAnalyzeView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        from .tasks import analyze_camera
        from .ai import AIUnavailable
        import os
        if not os.environ.get('SMART_CITY_AI_URL'):
            raise AIUnavailable()
        from django.conf import settings
        if not settings.USE_REDIS or not settings.CELERY_BROKER_URL:
            raise AIUnavailable('AI job queue unavailable. Connect Redis and Celery.')
        camera = get_object_or_404(Camera, pk=pk, is_active=True, rights_confirmed=True)
        alert = CameraAlert.objects.create(camera=camera, requested_by=request.user)
        try:
            analyze_camera.apply_async(args=[alert.pk], retry=False)
        except Exception:
            alert.status, alert.error = 'FAILED', 'AI job queue unavailable.'
            alert.save(update_fields=['status', 'error', 'updated_at'])
            raise CameraUnavailable('AI job queue unavailable.') from None
        return Response(CameraAlertSerializer(alert).data, status=202)


class CameraAlertListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response(CameraAlertSerializer(CameraAlert.objects.order_by('-created_at')[:100], many=True).data)


class CameraAlertReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['confirm', 'dismiss'])


class CameraAlertReviewView(GenericAPIView):
    queryset = CameraAlert.objects.none()
    permission_classes = [IsAdminUser]
    serializer_class = CameraAlertReviewSerializer

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            alert = get_object_or_404(CameraAlert.objects.select_for_update().select_related('camera'), pk=pk)
            if alert.status != 'REVIEW':
                raise ValidationError('Only pending operator reviews can be confirmed or dismissed.')
            if serializer.validated_data['action'] == 'confirm':
                alert.incident = TrafficIncident.objects.create(created_by=request.user, title=f'Camera review: {alert.camera.name}'[:150], description=alert.answer,
                    incident_type='OTHER', latitude=alert.camera.latitude, longitude=alert.camera.longitude)
                alert.status = 'CONFIRMED'
            else:
                alert.status = 'DISMISSED'
            alert.save(update_fields=['status', 'incident', 'updated_at'])
        return Response(CameraAlertSerializer(alert).data)
