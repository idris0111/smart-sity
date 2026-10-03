from django.contrib import admin

from .models import (BusStop, ParkingBooking, ParkingLot, ParkingSpot, Route,
                     RouteStop, ServiceRequest, TrafficIncident, Vehicle)
from .models import Camera, CameraAlert, RouteGeometry
from .cameras import CameraSerializer
from django import forms

class CameraForm(forms.ModelForm):
    class Meta:
        model = Camera
        fields = '__all__'

    def clean(self):
        data = super().clean()
        validated = {k: v for k, v in data.items() if k in ('stream_url', 'preview_url', 'latitude', 'longitude', 'is_active', 'rights_confirmed')}
        serializer = CameraSerializer(instance=self.instance if self.instance.pk else None, data=validated, partial=True)
        if not serializer.is_valid():
            raise forms.ValidationError(str(serializer.errors))
        return data

@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    form = CameraForm
    list_display = ('name', 'city', 'stream_type', 'status', 'is_active', 'last_seen')
    list_filter = ('status', 'stream_type', 'city', 'is_active')
    search_fields = ('name', 'address')
    readonly_fields = ('status', 'last_seen', 'latency_ms', 'created_at', 'updated_at')

@admin.register(CameraAlert)
class CameraAlertAdmin(admin.ModelAdmin):
    list_display = ('camera', 'status', 'confidence', 'created_at')
    readonly_fields = [field.name for field in CameraAlert._meta.fields]
    def has_add_permission(self, request):
        return False

@admin.register(RouteGeometry)
class RouteGeometryAdmin(admin.ModelAdmin):
    list_display = ('route', 'distance_m', 'source', 'updated_at')
    readonly_fields = [field.name for field in RouteGeometry._meta.fields]
    def has_add_permission(self, request):
        return False


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
