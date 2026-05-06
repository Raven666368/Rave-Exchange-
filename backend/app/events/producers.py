from app.events.bus import bus
import json

class EventProducer:
    async def publish_order(self, order):
        await bus.publish("orders", {
            "order_id": str(order.id),
            "symbol": str(order.symbol),
            "status": str(order.status)
        })

    async def publish_position(self, position):
        # Convert all to strings or JSON for Redis streams
        str_pos = {k: str(v) for k, v in position.items()}
        await bus.publish("positions", str_pos)

    async def publish_pnl(self, pnl_data):
        str_pnl = {k: str(v) for k, v in pnl_data.items()}
        await bus.publish("pnl_updates", str_pnl)
