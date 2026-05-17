import asyncio
import logging
from app.events.bus import bus
from app.engine.websocket.manager import manager
from app.events.idempotency import IdempotencyStore

logger = logging.getLogger(__name__)
idempotency = IdempotencyStore()

async def strategy_consumer(cluster, bus):
    await bus.create_group("market_ticks", "strategy_group")
    while True:
        messages = await bus.consume("market_ticks", "strategy_group", "worker_1")
        if messages:
            for stream, msgs in messages:
                for msg_id, data in msgs:
                    if idempotency.already_seen(msg_id):
                        await bus.client.xack("market_ticks", "strategy_group", msg_id)
                        continue

                    # Attempt to process tick
                    try:
                        await cluster.process_tick(data)
                        idempotency.mark_seen(msg_id)
                        await bus.client.xack("market_ticks", "strategy_group", msg_id)
                    except Exception as e:
                        logger.error(f"Error processing tick in cluster: {e}")
        await asyncio.sleep(0.1)
