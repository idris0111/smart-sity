import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
app = Celery('smart_city')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
