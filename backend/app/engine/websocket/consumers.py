import asyncio
import logging
import time
from app.events.bus import bus
from app.engine.websocket.manager import manager
from app.events.idempotency import IdempotencyStore

logger = logging.getLogger(__name__)

idempotency = IdempotencyStore()

async def process_stream(stream_name: str, group_name: str, consumer_name: str, event_name: str):
    await bus.create_group(stream_name, group_name)
    last_time = 0
    MAX_EVENTS_PER_SECOND = 50

    while True:
        messages = await bus.consume(stream_name, group_name, consumer_name)
        if messages:
            for stream, msgs in messages:
                for msg_id, data in msgs:
                    # Idempotency check
                    if idempotency.already_seen(msg_id):
                        await bus.client.xack(stream_name, group_name, msg_id)
                        continue

                    # Backpressure control
                    now = time.time()
                    if now - last_time < (1.0 / MAX_EVENTS_PER_SECOND):
                        await asyncio.sleep((1.0 / MAX_EVENTS_PER_SECOND) - (now - last_time))
                    last_time = time.time()

                    retries = 0
                    success = False
                    
                    while retries <= 3 and not success:
                        try:
                            # Forward to WebSocket
                            payload = {"event": event_name, "data": data}
                            await manager.broadcast_json(payload)
                            
                            idempotency.mark_seen(msg_id)
                            success = True
                            
                            # Acknowledge the message so it's removed from pending
                            await bus.client.xack(stream_name, group_name, msg_id)
                        except Exception as e:
                            logger.error(f"Error processing {stream_name} message {msg_id}: {e}")
                            retries += 1
                            await asyncio.sleep(0.5)
                            
                    if not success:
                        # Dead-letter queue
                        dlq_stream = f"{stream_name}_dlq"
                        logger.warning(f"Message {msg_id} failed 3 retries, sending to DLQ: {dlq_stream}")
                        await bus.publish(dlq_stream, data)
                        # Still ack the original to remove it from group
                        await bus.client.xack(stream_name, group_name, msg_id)

        await asyncio.sleep(0.1)

async def order_consumer():
    await process_stream("orders", "orders_group", "worker_1", "order_update")

async def position_consumer():
    await process_stream("positions", "positions_group", "worker_1", "position_update")

async def pnl_consumer():
    await process_stream("pnl_updates", "pnl_group", "worker_1", "pnl_update")

async def start_consumers():
    tasks = [
        asyncio.create_task(order_consumer()),
        asyncio.create_task(position_consumer()),
        asyncio.create_task(pnl_consumer()),
    ]
    return tasks
