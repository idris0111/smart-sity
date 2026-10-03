import asyncio
import time
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from redis.exceptions import RedisError
from django.conf import settings


@database_sync_to_async
def authenticate(token):
    access = AccessToken(token)
    return JWTAuthentication().get_user(access), access['exp']


class CityConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.user = None
        self.groups_joined = []
        await self.accept()
        self.timeout = asyncio.create_task(self.close_later(5))
        if not settings.REALTIME_ENABLED:
            await self.close(code=1013)

    async def close_later(self, seconds):
        await asyncio.sleep(max(0, seconds))
        await self.close(code=4401)

    async def receive_json(self, content, **kwargs):
        # JWT is sent in the first frame, never in URLs or access logs.
        if self.user is not None or not isinstance(content, dict) or content.get('type') != 'authenticate':
            await self.close(code=4403)
            return
        try:
            self.user, self.expires = await authenticate(content.get('access', ''))
        except (TokenError, AuthenticationFailed, TypeError, ValueError):
            await self.close(code=4401)
            return
        self.timeout.cancel()
        self.groups_joined = ['city.vehicles', 'city.cameras', 'city.infrastructure', 'city.admin' if self.user.is_staff else f'city.user.{self.user.pk}']
        try:
            for group in self.groups_joined:
                await self.channel_layer.group_add(group, self.channel_name)
        except (RedisError, OSError):
            self.groups_joined = []
            await self.close(code=1013)
            return
        self.timeout = asyncio.create_task(self.close_later(self.expires - time.time()))
        await self.send_json({'kind': 'connected'})

    async def city_update(self, event):
        if self.user is None or time.time() >= self.expires:
            await self.close(code=4401)
            return
        await self.send_json(event['event'])

    async def disconnect(self, code):
        self.timeout.cancel()
        for group in self.groups_joined:
            try:
                await self.channel_layer.group_discard(group, self.channel_name)
            except (RedisError, OSError):
                continue
