import redis.asyncio as redis
import logging

logger = logging.getLogger(__name__)

class RedisBus:
    def __init__(self):
        # We assume Redis is running on localhost. In production, load from config.
        self.client = redis.Redis(host="localhost", port=6379, decode_responses=True)

    async def publish(self, stream: str, data: dict):
        try:
            await self.client.xadd(stream, data)
        except Exception as e:
            logger.error(f"Failed to publish to {stream}: {e}")

    async def consume(self, stream: str, group: str, consumer: str):
        try:
            return await self.client.xreadgroup(
                groupname=group,
                consumername=consumer,
                streams={stream: '>'},
                count=10,
                block=5000
            )
        except Exception as e:
            logger.error(f"Error consuming {stream}: {e}")
            return []

    async def create_group(self, stream: str, group: str):
        try:
            await self.client.xgroup_create(stream, group, mkstream=True)
            logger.info(f"Created consumer group {group} for stream {stream}")
        except redis.exceptions.ResponseError as e:
            if "BUSYGROUP" in str(e):
                pass # Group already exists
            else:
                logger.error(f"Failed to create group {group} for {stream}: {e}")

bus = RedisBus()
