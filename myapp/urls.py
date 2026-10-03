from django.urls import path
from .views import *
from .system import SystemStatusView, ExternalLayerView
from .cameras import (CameraListView, CameraDetailView, CameraMapView, CameraNearbyView,
                     CameraStatusView, CameraAccessView, CameraStreamView, CameraSnapshotView,
                     CameraAnalyzeView, CameraAlertListView, CameraAlertReviewView, CameraWHEPView)

urlpatterns = [
    path('system/status/', SystemStatusView.as_view()),
    path('layers/<str:key>/', ExternalLayerView.as_view()),
    path('cameras/', CameraListView.as_view()),
    path('cameras/map/', CameraMapView.as_view()),
    path('cameras/nearby/', CameraNearbyView.as_view()),
    path('cameras/<int:pk>/', CameraDetailView.as_view()),
    path('cameras/<int:pk>/status/', CameraStatusView.as_view()),
    path('cameras/<int:pk>/access/', CameraAccessView.as_view()),
    path('cameras/<int:pk>/snapshot/', CameraSnapshotView.as_view()),
    path('cameras/<int:pk>/stream/', CameraStreamView.as_view()),
    path('cameras/<int:pk>/whep/', CameraWHEPView.as_view()),
    path('cameras/<int:pk>/analyze/', CameraAnalyzeView.as_view()),
    path('ai-alerts/', CameraAlertListView.as_view()),
    path('ai-alerts/<int:pk>/review/', CameraAlertReviewView.as_view()),
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
    path('route-paths/<str:number>/', RoutePathView.as_view()),

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
