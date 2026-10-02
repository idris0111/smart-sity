from django.utils import timezone
from rest_framework import serializers

from .models import (BusStop, ParkingBooking, ParkingLot, ParkingSpot, Route,
                     RouteStop, ServiceRequest, TrafficIncident, Vehicle)


class AvailabilityQuerySerializer(serializers.Serializer):
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField()

    def validate(self, attrs):
        if attrs['end_time'] <= attrs['start_time']:
            raise serializers.ValidationError('Окончание должно быть позже начала')
        return attrs


class AvailabilitySpotSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    number = serializers.CharField()
    spot_type = serializers.CharField()
    available = serializers.BooleanField()


class AssistantInputSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=4000)


class CameraInputSerializer(serializers.Serializer):
    image = serializers.CharField(max_length=3000000)

    def validate_image(self, value):
        import base64
        if not value.startswith('data:image/jpeg;base64,'):
            raise serializers.ValidationError('Ожидается JPEG кадр')
        try:
            data = base64.b64decode(value.split(',', 1)[1], validate=True)
        except ValueError:
            raise serializers.ValidationError('Некорректный base64')
        if not data.startswith(b'\xff\xd8\xff'):
            raise serializers.ValidationError('Некорректный JPEG')
        return value


class ParkingLotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingLot
        fields = '__all__'


class ParkingSpotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParkingSpot
        fields = '__all__'


class ParkingBookingSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ParkingBooking
        fields = '__all__'

    def validate_status(self, value):
        request = self.context.get('request')
        if request and not request.user.is_staff and value == 'COMPLETED':
            raise serializers.ValidationError('Только администратор может завершить бронь')
        return value

    def validate(self, attrs):
        spot = attrs.get('parking_spot') or getattr(self.instance, 'parking_spot', None)
        start_time = attrs.get('start_time') or getattr(self.instance, 'start_time', None)
        end_time = attrs.get('end_time') or getattr(self.instance, 'end_time', None)
        status = attrs.get('status') or getattr(self.instance, 'status', 'BOOKED')

        if start_time is not None and end_time is not None and end_time <= start_time:
            raise serializers.ValidationError('end_time должен быть больше start_time')

        if status != 'BOOKED':
            return attrs

        changing_booking = self.instance is None or any(
            field in attrs for field in ('parking_spot', 'start_time', 'end_time', 'status')
        )
        if start_time is not None and start_time < timezone.now() and changing_booking:
            raise serializers.ValidationError('Нельзя бронировать парковку в прошлом')

        if spot is not None and (not spot.is_active or not spot.parking.is_active):
            raise serializers.ValidationError('Это парковочное место недоступно')

        if spot is None or start_time is None or end_time is None:
            return attrs

        bookings = ParkingBooking.objects.filter(
            parking_spot=spot,
            status='BOOKED',
            start_time__lt=end_time,
            end_time__gt=start_time,
        )

        if self.instance:
            bookings = bookings.exclude(id=self.instance.id)

        if bookings.exists():
            raise serializers.ValidationError('Это место уже забронировано на это время')

        return attrs


class BusStopSerializer(serializers.ModelSerializer):
    class Meta:
        model = BusStop
        fields = '__all__'


class RouteStopSerializer(serializers.ModelSerializer):
    stop_details = BusStopSerializer(source='stop', read_only=True)

    class Meta:
        model = RouteStop
        fields = ['id', 'route', 'stop', 'order', 'stop_details']

    def validate_order(self, value):
        if value < 1:
            raise serializers.ValidationError('Порядок начинается с 1')
        return value

    def validate(self, attrs):
        route = attrs.get('route') or getattr(self.instance, 'route', None)
        stop = attrs.get('stop') or getattr(self.instance, 'stop', None)
        order = attrs.get('order') if 'order' in attrs else getattr(self.instance, 'order', None)
        if route is None or stop is None or order is None:
            return attrs

        others = RouteStop.objects.filter(route=route)
        if self.instance:
            others = others.exclude(pk=self.instance.pk)
        if others.filter(stop=stop).exists():
            raise serializers.ValidationError('Остановка уже есть в этом маршруте')
        if others.filter(order=order).exists():
            raise serializers.ValidationError('Порядковый номер уже занят в этом маршруте')
        return attrs


class RouteSerializer(serializers.ModelSerializer):
    route_stops = RouteStopSerializer(many=True, read_only=True)

    class Meta:
        model = Route
        fields = ['id', 'number', 'name', 'is_active', 'route_stops']


class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = '__all__'


class TrafficIncidentSerializer(serializers.ModelSerializer):
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = TrafficIncident
        fields = '__all__'


class ServiceRequestSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = ServiceRequest
        fields = '__all__'

    def validate_status(self, value):
        request = self.context.get('request')
        if request and not request.user.is_staff:
            current = self.instance.status if self.instance else 'NEW'
            if value != current:
                raise serializers.ValidationError('Только администратор может менять статус')
        return value
