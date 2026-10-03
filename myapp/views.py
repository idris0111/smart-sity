import json
import logging

from django.conf import settings
from django.core.cache import cache
from django.http import Http404
from drf_yasg.utils import swagger_auto_schema
from rest_framework.generics import GenericAPIView, ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import (BusStop, ParkingBooking, ParkingLot, ParkingSpot, Route,RouteStop, ServiceRequest, TrafficIncident, Vehicle)
from .permissions import IsAdminOrReadOnly, IsOwnerOrAdmin
from .serializer import (BusStopSerializer, ParkingBookingSerializer,ParkingLotSerializer, ParkingSpotSerializer, RouteSerializer,RouteStopSerializer, ServiceRequestSerializer,TrafficIncidentSerializer, VehicleSerializer)
from .serializer import AvailabilityQuerySerializer, AvailabilitySpotSerializer
from .serializer import AssistantInputSerializer, CameraInputSerializer
from .ai import ask_provider
from redis.exceptions import RedisError


class AssistantView(GenericAPIView):
    serializer_class = AssistantInputSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from .assistant_context import city_context, safe_actions
        from django.core.serializers.json import DjangoJSONEncoder
        context = json.loads(json.dumps(city_context(request.user), cls=DjangoJSONEncoder))
        result = ask_provider({'task': 'assistant', **serializer.validated_data, 'context': context,
                              'action_schema': ['fly_to(latitude,longitude)', 'show_cameras_near(latitude,longitude)',
                                                'select_camera(id)', 'select_parking(id)', 'select_vehicle(id)',
                                                'show_route(id)', 'toggle_layer(layer,enabled)']})
        return Response({'answer': result['answer'], 'actions': safe_actions(result.get('actions'), context)})


class CameraAnalysisView(GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CameraInputSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = ask_provider({'task': 'camera', **serializer.validated_data})
        return Response({'answer': result['answer'], 'confirmed': False,'recommendation': 'Возможная опасная ситуация. Рекомендуется проверить.'})


class ParkingLotListCreateView(ListCreateAPIView):
    queryset = ParkingLot.objects.all()
    serializer_class = ParkingLotSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        from django.db.models import Count, Q, Subquery
        from django.utils import timezone
        now = timezone.now()
        busy = ParkingBooking.objects.filter(status='BOOKED',start_time__lte=now,end_time__gt=now).values('parking_spot_id')
        return ParkingLot.objects.annotate(
            total_spots=Count('spots',filter=Q(spots__is_active=True),distinct=True),
            free_spots=Count('spots',filter=Q(spots__is_active=True)&~Q(spots__id__in=Subquery(busy)),distinct=True))


class ParkingLotDetailView(RetrieveUpdateDestroyAPIView):
    queryset = ParkingLot.objects.all()
    serializer_class = ParkingLotSerializer
    permission_classes = [IsAdminOrReadOnly]


class ParkingSpotListCreateView(ListCreateAPIView):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = ParkingSpot.objects.all()
        value = self.request.query_params.get('parking')
        if value is not None:
            if not value.isdecimal():
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'parking': 'Укажите числовой ID'})
            queryset = queryset.filter(parking_id=value)
        return queryset


class ParkingSpotDetailView(RetrieveUpdateDestroyAPIView):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer
    permission_classes = [IsAdminOrReadOnly]


class ParkingAvailabilityView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(query_serializer=AvailabilityQuerySerializer,
                         responses={200: AvailabilitySpotSerializer(many=True)})
    def get(self, request, pk):
        parking = ParkingLot.objects.filter(pk=pk).first()
        if parking is None:
            raise Http404
        query = AvailabilityQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        start = query.validated_data['start_time']
        end = query.validated_data['end_time']
        busy = set(ParkingBooking.objects.filter(
            parking_spot__parking=parking,
            status='BOOKED',
            start_time__lt=end,
            end_time__gt=start,
        ).values_list('parking_spot_id', flat=True))
        spots = ParkingSpot.objects.filter(parking=parking).order_by('number')
        return Response([
            {'id': spot.id, 'number': spot.number, 'spot_type': spot.spot_type,
             'available': parking.is_active and spot.is_active and spot.id not in busy}
            for spot in spots
        ])


class ParkingBookingListCreateView(ListCreateAPIView):
    serializer_class = ParkingBookingSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        bookings = ParkingBooking.objects.all()
        if not self.request.user.is_authenticated:
            return bookings.none()
        if self.request.user.is_staff:
            return bookings
        return bookings.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ParkingBookingDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = ParkingBookingSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        bookings = ParkingBooking.objects.all()
        if not self.request.user.is_authenticated:
            return bookings.none()
        if self.request.user.is_staff:
            return bookings
        return bookings.filter(user=self.request.user)


class BusStopListCreateView(ListCreateAPIView):
    queryset = BusStop.objects.all()
    serializer_class = BusStopSerializer
    permission_classes = [IsAdminOrReadOnly]


class BusStopDetailView(RetrieveUpdateDestroyAPIView):
    queryset = BusStop.objects.all()
    serializer_class = BusStopSerializer
    permission_classes = [IsAdminOrReadOnly]


class RouteListCreateView(ListCreateAPIView):
    queryset = Route.objects.prefetch_related('route_stops__stop').all()
    serializer_class = RouteSerializer
    permission_classes = [IsAdminOrReadOnly]

    def list(self, request, *args, **kwargs):
        try:
            data = cache.get('city:routes')
        except RedisError:
            data = None
            logging.getLogger(__name__).warning('Redis cache unavailable; reading routes from database')
        if data is None:
            data = self.get_serializer(self.get_queryset(), many=True).data
            try:
                cache.set('city:routes', data, timeout=60)
            except RedisError:
                logging.getLogger(__name__).warning('Redis cache unavailable; routes were not cached')
        return Response(data)


class RouteDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Route.objects.prefetch_related('route_stops__stop').all()
    serializer_class = RouteSerializer
    permission_classes = [IsAdminOrReadOnly]


class RoutePathView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, number):
        routes = Route.objects.filter(number=str(number))
        if request.query_params.get('route_id'):
            value = request.query_params['route_id']
            if not value.isdecimal():
                from rest_framework.exceptions import ValidationError
                raise ValidationError('route_id must be an integer.')
            routes = routes.filter(pk=value)
        route = routes.first()
        if route is None:
            raise Http404
        from .road_routing import road_geometry, geometry_payload
        return Response(geometry_payload(route, road_geometry(route)))


class RouteSearchView(ListAPIView):
    serializer_class = RouteSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Route.objects.none()
        from django.shortcuts import get_object_or_404
        start_id = self.kwargs['start_id']
        end_id = self.kwargs['end_id']
        get_object_or_404(BusStop, pk=start_id)
        get_object_or_404(BusStop, pk=end_id)
        route_ids = []
        for start_stop in RouteStop.objects.filter(stop_id=start_id, route__is_active=True):
            end_stop = RouteStop.objects.filter(route=start_stop.route, stop_id=end_id).first()
            if end_stop and start_stop.order < end_stop.order:
                route_ids.append(start_stop.route_id)
        return Route.objects.filter(pk__in=route_ids).prefetch_related('route_stops__stop')


class RouteStopListCreateView(ListCreateAPIView):
    queryset = RouteStop.objects.select_related('stop').all()
    serializer_class = RouteStopSerializer
    permission_classes = [IsAdminOrReadOnly]


class RouteStopDetailView(RetrieveUpdateDestroyAPIView):
    queryset = RouteStop.objects.select_related('stop').all()
    serializer_class = RouteStopSerializer
    permission_classes = [IsAdminOrReadOnly]


class VehicleListCreateView(ListCreateAPIView):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Vehicle.objects.all()
        value = self.request.query_params.get('route')
        if value is not None:
            if not value.isdecimal():
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'route': 'Укажите числовой ID'})
            queryset = queryset.filter(route_id=value)
        return queryset


class VehicleDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAdminOrReadOnly]


class TrafficIncidentListCreateView(ListCreateAPIView):
    serializer_class = TrafficIncidentSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        incidents = TrafficIncident.objects.all()
        if not self.request.user.is_authenticated:
            return incidents.none()
        if self.request.user.is_staff:
            return incidents
        return incidents.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class TrafficIncidentDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = TrafficIncidentSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        incidents = TrafficIncident.objects.all()
        if not self.request.user.is_authenticated:
            return incidents.none()
        if self.request.user.is_staff:
            return incidents
        return incidents.filter(created_by=self.request.user)


class ServiceRequestListCreateView(ListCreateAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        requests = ServiceRequest.objects.all()
        if not self.request.user.is_authenticated:
            return requests.none()
        if self.request.user.is_staff:
            return requests
        return requests.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ServiceRequestDetailView(RetrieveUpdateDestroyAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        requests = ServiceRequest.objects.all()
        if not self.request.user.is_authenticated:
            return requests.none()
        if self.request.user.is_staff:
            return requests
        return requests.filter(user=self.request.user)
