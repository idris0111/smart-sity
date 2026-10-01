from django.contrib import admin

from .models import (BusStop, ParkingBooking, ParkingLot, ParkingSpot, Route,
                     RouteStop, ServiceRequest, TrafficIncident, Vehicle)


class RouteStopInline(admin.TabularInline):
    model = RouteStop
    extra = 1


@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ('number', 'name', 'is_active')
    search_fields = ('number', 'name')
    inlines = [RouteStopInline]


@admin.register(ParkingLot)
class ParkingLotAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'is_active')
    search_fields = ('name', 'address')


@admin.register(ParkingSpot)
class ParkingSpotAdmin(admin.ModelAdmin):
    list_display = ('number', 'parking', 'spot_type', 'is_active')
    list_filter = ('parking', 'spot_type', 'is_active')


@admin.register(BusStop)
class BusStopAdmin(admin.ModelAdmin):
    list_display = ('name', 'address', 'latitude', 'longitude')
    search_fields = ('name', 'address')


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('plate_number', 'vehicle_type', 'route', 'is_active')
    list_filter = ('vehicle_type', 'is_active')


admin.site.register(RouteStop)
admin.site.register(ParkingBooking)
admin.site.register(TrafficIncident)
admin.site.register(ServiceRequest)
