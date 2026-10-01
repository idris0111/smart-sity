import json

from django.conf import settings
from django.http import Http404
from rest_framework.generics import ListAPIView, ListCreateAPIView, RetrieveUpdateDestroyAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import (BusStop, ParkingBooking, ParkingLot, ParkingSpot, Route,RouteStop, ServiceRequest, TrafficIncident, Vehicle)
from .permissions import IsAdminOrReadOnly, IsOwnerOrAdmin
from .serializer import (BusStopSerializer, ParkingBookingSerializer,ParkingLotSerializer, ParkingSpotSerializer, RouteSerializer,RouteStopSerializer, ServiceRequestSerializer,TrafficIncidentSerializer, VehicleSerializer)


class ParkingLotListCreateView(ListCreateAPIView):
    queryset = ParkingLot.objects.all()
    serializer_class = ParkingLotSerializer
    permission_classes = [IsAdminOrReadOnly]


class ParkingLotDetailView(RetrieveUpdateDestroyAPIView):
    queryset = ParkingLot.objects.all()
    serializer_class = ParkingLotSerializer
    permission_classes = [IsAdminOrReadOnly]


class ParkingSpotListCreateView(ListCreateAPIView):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer
    permission_classes = [IsAdminOrReadOnly]


class ParkingSpotDetailView(RetrieveUpdateDestroyAPIView):
    queryset = ParkingSpot.objects.all()
    serializer_class = ParkingSpotSerializer
    permission_classes = [IsAdminOrReadOnly]


class ParkingBookingListCreateView(ListCreateAPIView):
    serializer_class = ParkingBookingSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        bookings = ParkingBooking.objects.all()
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


class RouteDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Route.objects.prefetch_related('route_stops__stop').all()
    serializer_class = RouteSerializer
    permission_classes = [IsAdminOrReadOnly]


class RouteSearchView(ListAPIView):
    serializer_class = RouteSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        start = self.request.query_params.get('start_stop')
        end = self.request.query_params.get('end_stop')
        if not start or not end or not start.isdecimal() or not end.isdecimal():
            return Route.objects.none()

        start_orders = dict(RouteStop.objects.filter(stop_id=start).values_list('route_id', 'order'))
        route_ids = [
            route_id
            for route_id, end_order in RouteStop.objects.filter(stop_id=end).values_list('route_id', 'order')
            if route_id in start_orders and start_orders[route_id] < end_order
        ]
        return Route.objects.filter(id__in=route_ids, is_active=True).prefetch_related('route_stops__stop')


class RoutePathView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, number):
        if not Route.objects.filter(number=number, name='DEMO Route 88').exists():
            raise Http404
        path_file = settings.BASE_DIR / 'myapp' / 'fixtures' / 'route_paths.json'
        with path_file.open(encoding='utf-8') as file:
            paths = json.load(file)
        if number not in paths:
            raise Http404
        return Response(paths[number])


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


class VehicleDetailView(RetrieveUpdateDestroyAPIView):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [IsAdminOrReadOnly]


class TrafficIncidentListCreateView(ListCreateAPIView):
    serializer_class = TrafficIncidentSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        incidents = TrafficIncident.objects.all()
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
        if self.request.user.is_staff:
            return incidents
        return incidents.filter(created_by=self.request.user)


class ServiceRequestListCreateView(ListCreateAPIView):
    serializer_class = ServiceRequestSerializer
    permission_classes = [IsOwnerOrAdmin]

    def get_queryset(self):
        requests = ServiceRequest.objects.all()
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
        if self.request.user.is_staff:
            return requests
        return requests.filter(user=self.request.user)
