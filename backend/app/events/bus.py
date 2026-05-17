import asyncio
import logging
import uuid
import time

logger = logging.getLogger(__name__)

class InMemoryBus:
    def __init__(self):
        self.streams = {}
        self.groups = {}

    async def publish(self, stream: str, data: dict):
        try:
            if stream not in self.streams:
                self.streams[stream] = []
            msg_id = f"{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}"
            # Convert non-string values to string to simulate redis hashes
            str_data = {str(k): str(v) if not isinstance(v, (str, int, float)) else str(v) for k, v in data.items()}
            self.streams[stream].append((msg_id, str_data))
        except Exception as e:
            logger.error(f"Failed to publish to {stream}: {e}")

    async def consume(self, stream: str, group: str, consumer: str):
        try:
            if stream not in self.streams:
                self.streams[stream] = []
            
            group_key = f"{stream}:{group}"
            if group_key not in self.groups:
                self.groups[group_key] = 0
            
            # Simple polling implementation
            await asyncio.sleep(0.5) 
            
            messages = self.streams[stream][self.groups[group_key]:]
            if not messages:
                return []
            
            # We take up to 10 messages
            taken = messages[:10]
            self.groups[group_key] += len(taken)
            
            return [[stream, taken]]
        except Exception as e:
            logger.error(f"Error consuming {stream}: {e}")
            return []

    async def create_group(self, stream: str, group: str):
        group_key = f"{stream}:{group}"
        if group_key not in self.groups:
            self.groups[group_key] = 0
            logger.info(f"Created consumer group {group} for stream {stream}")

bus = InMemoryBus()

