from django.urls import path
from .views import *

urlpatterns = [
    path('parkings/',ParkingLotListCreateView.as_view()),
    path('parkings/<int:pk>/',ParkingLotDetailView.as_view()),

    path('parking-spots/',ParkingSpotListCreateView.as_view()),
    path('parking-spots/<int:pk>/',ParkingSpotDetailView.as_view()),

    path('bookings/',ParkingBookingListCreateView.as_view()),
    path('bookings/<int:pk>/',ParkingBookingDetailView.as_view()),

    path('stops/',BusStopListCreateView.as_view()),
    path('stops/<int:pk>/',BusStopDetailView.as_view()),

    path('routes/',RouteListCreateView.as_view()),
    path('routes/search/',RouteSearchView.as_view()),
    path('route-paths/<str:number>/',RoutePathView.as_view()),
    path('routes/<int:pk>/',RouteDetailView.as_view()),

    path('route-stops/',RouteStopListCreateView.as_view()),
    path('route-stops/<int:pk>/',RouteStopDetailView.as_view()),

    path('vehicles/',VehicleListCreateView.as_view()),
    path('vehicles/<int:pk>/',VehicleDetailView.as_view()),

    path('incidents/',TrafficIncidentListCreateView.as_view()),
    path('incidents/<int:pk>/',TrafficIncidentDetailView.as_view()),

    path('service-requests/',ServiceRequestListCreateView.as_view()),
    path('service-requests/<int:pk>/',ServiceRequestDetailView.as_view()),
]
