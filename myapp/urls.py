from django.urls import path
from .views import *

urlpatterns = [
    path('assistant/', AssistantView.as_view()),
    path('camera/analyze/', CameraAnalysisView.as_view()),
    # Parking Lots
    path('parkings/', ParkingLotListCreateView.as_view()),
    path('parkings/<int:pk>/', ParkingLotDetailView.as_view()),
    path('parkings/<int:pk>/availability/', ParkingAvailabilityView.as_view()),

    # Parking Spots
    path('parking-spots/', ParkingSpotListCreateView.as_view()),
    path('parking-spots/<int:pk>/', ParkingSpotDetailView.as_view()),

    # Parking Bookings
    path('bookings/', ParkingBookingListCreateView.as_view()),
    path('bookings/<int:pk>/', ParkingBookingDetailView.as_view()),

    # Bus Stops
    path('stops/', BusStopListCreateView.as_view()),
    path('stops/<int:pk>/', BusStopDetailView.as_view()),

    # Routes
    path('routes/', RouteListCreateView.as_view()),
    path('routes/search/<int:start_id>/<int:end_id>/', RouteSearchView.as_view()),
    path('routes/<int:pk>/', RouteDetailView.as_view()),

    # Route Stops
    path('route-stops/', RouteStopListCreateView.as_view()),
    path('route-stops/<int:pk>/', RouteStopDetailView.as_view()),

    # Vehicles
    path('vehicles/', VehicleListCreateView.as_view()),
    path('vehicles/<int:pk>/', VehicleDetailView.as_view()),

    # Traffic Incidents
    path('incidents/', TrafficIncidentListCreateView.as_view()),
    path('incidents/<int:pk>/', TrafficIncidentDetailView.as_view()),

    # Service Requests
    path('service-requests/', ServiceRequestListCreateView.as_view()),
    path('service-requests/<int:pk>/', ServiceRequestDetailView.as_view()),
]
