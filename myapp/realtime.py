import logging
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


def publish(group, event):
    if not settings.REALTIME_ENABLED:
        return
    try:
        async_to_sync(get_channel_layer().group_send)(group, {'type': 'city.update', 'event': event})
    except (RedisError, OSError):
        logger.exception('Redis unavailable: realtime delivery failed; REST record is saved')


def publish_private(user_id, event):
    publish(f'city.user.{user_id}', event)
    publish('city.admin', event)
