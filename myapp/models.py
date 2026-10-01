from django.db import models
from django.conf import settings

class ParkingLot(models.Model):
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=9,decimal_places=6)
    longitude = models.DecimalField(max_digits=9,decimal_places=6)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class ParkingSpot(models.Model):
    SPOT_TYPES = [
        ('NORMAL','Normal'),
        ('DISABLED','Disabled'),
        ('EV','Electric Vehicle'),
    ]
    parking = models.ForeignKey(ParkingLot,on_delete=models.CASCADE,related_name='spots')
    number = models.CharField(max_length=20)
    spot_type = models.CharField(max_length=20,choices=SPOT_TYPES,default='NORMAL')
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.parking.name} - {self.number}'

class ParkingBooking(models.Model):
    STATUS_CHOICES = [
        ('BOOKED','Booked'),
        ('CANCELLED','Cancelled'),
        ('COMPLETED','Completed'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='parking_bookings')
    parking_spot = models.ForeignKey(ParkingSpot,on_delete=models.CASCADE,related_name='bookings')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=20,choices=STATUS_CHOICES,default='BOOKED')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user} - {self.parking_spot}'

class BusStop(models.Model):
    name = models.CharField(max_length=150)
    address = models.CharField(max_length=255,blank=True)
    latitude = models.DecimalField(max_digits=9,decimal_places=6)
    longitude = models.DecimalField(max_digits=9,decimal_places=6)

    def __str__(self):
        return self.name

class Route(models.Model):
    number = models.CharField(max_length=20)
    name = models.CharField(max_length=150)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'{self.number} - {self.name}'

class RouteStop(models.Model):
    route = models.ForeignKey(Route,on_delete=models.CASCADE,related_name='route_stops')
    stop = models.ForeignKey(BusStop,on_delete=models.CASCADE,related_name='route_stops')
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ['order']
        constraints = [
            models.CheckConstraint(condition=models.Q(order__gte=1), name='route_stop_order_from_one'),
            models.UniqueConstraint(fields=['route', 'order'], name='unique_route_stop_order'),
            models.UniqueConstraint(fields=['route', 'stop'], name='unique_stop_per_route'),
        ]

    def __str__(self):
        return f'{self.route} - {self.stop}'

class Vehicle(models.Model):
    VEHICLE_TYPES = [
        ('BUS','Bus'),
        ('MINIBUS','Minibus'),
        ('TAXI','Taxi'),
    ]
    route = models.ForeignKey(Route,on_delete=models.SET_NULL,null=True,blank=True,related_name='vehicles')
    vehicle_type = models.CharField(max_length=20,choices=VEHICLE_TYPES,default='BUS')
    plate_number = models.CharField(max_length=30,unique=True)
    latitude = models.DecimalField(max_digits=9,decimal_places=6,null=True,blank=True)
    longitude = models.DecimalField(max_digits=9,decimal_places=6,null=True,blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.plate_number

class TrafficIncident(models.Model):
    INCIDENT_TYPES = [
        ('ACCIDENT','Accident'),
        ('TRAFFIC','Traffic'),
        ('ROAD_WORK','Road Work'),
        ('CLOSED_ROAD','Closed Road'),
        ('OTHER','Other'),
    ]
    STATUS_CHOICES = [
        ('ACTIVE','Active'),
        ('RESOLVED','Resolved'),
    ]
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='traffic_incidents')
    title = models.CharField(max_length=150)
    description = models.TextField()
    incident_type = models.CharField(max_length=30,choices=INCIDENT_TYPES)
    latitude = models.DecimalField(max_digits=9,decimal_places=6)
    longitude = models.DecimalField(max_digits=9,decimal_places=6)
    status = models.CharField(max_length=20,choices=STATUS_CHOICES,default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class ServiceRequest(models.Model):
    REQUEST_TYPES = [
        ('ROAD','Road'),
        ('LIGHT','Street Light'),
        ('WASTE','Waste'),
        ('WATER','Water'),
        ('OTHER','Other'),
    ]
    STATUS_CHOICES = [
        ('NEW','New'),
        ('IN_PROGRESS','In Progress'),
        ('DONE','Done'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE,related_name='service_requests')
    request_type = models.CharField(max_length=30,choices=REQUEST_TYPES)
    description = models.TextField()
    latitude = models.DecimalField(max_digits=9,decimal_places=6)
    longitude = models.DecimalField(max_digits=9,decimal_places=6)
    status = models.CharField(max_length=30,choices=STATUS_CHOICES,default='NEW')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user} - {self.request_type}'
