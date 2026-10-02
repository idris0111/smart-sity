"""Isolated unit tests; live integration uses core.settings and real services."""
from .settings import *

if os.environ.get('POSTGRES_TESTS', '0') != '1':
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
REALTIME_ENABLED = False
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
