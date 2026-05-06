from app.events.producers import EventProducer
import asyncio
from app.broker.order_router import OrderRouter
from app.broker.execution_tracker import ExecutionTracker
from app.broker.bybit_adapter import BybitAdapter

class ExecutionEngine:
    def __init__(self):
        from app.engine.risk_engine import RiskEngine
        from app.engine.position_engine import PositionEngine
        from app.engine.state_machine import OrderStateMachine
        from app.engine.order_manager import OrderManager
        from app.engine.pnl_engine import PnLEngine

        self.risk = RiskEngine()
        self.positions = PositionEngine()
        self.sm = OrderStateMachine()
        self.orders = OrderManager(self.risk, self.positions, self.sm)
        self.pnl = PnLEngine()
        
        self.events = EventProducer()
        self.balance = 10000

        import os
        # Initialize broker adapters
        bybit_api_key = os.getenv("BYBIT_API_KEY", "mock")
        bybit_api_secret = os.getenv("BYBIT_API_SECRET", "mock")
        bybit = BybitAdapter(bybit_api_key, bybit_api_secret)
        
        self.router = OrderRouter({"bybit": bybit})
        self.tracker = ExecutionTracker()

    async def place_order(self, order, price):
        # We process the internal representation
        position = self.orders.execute(order, price, self.balance)
        
        # We route execution to the real broker in parallel (conceptually)
        # Because we're simulating here, we wait or background it
        response = await self.router.route(order)
        order_internal_id = getattr(order, 'id', order.get('id', 'unknown'))
        
        # Assuming the response has a real orderId if successful
        broker_order_id = response.get("result", {}).get("orderId", order_internal_id)
        
        self.tracker.register(broker_order_id, response)
        
        await self.events.publish_order(order)
        await self.events.publish_position(position)
        
        # Attach the broker response to the position for visibility
        if isinstance(position, dict):
            position["broker_response"] = response

        return position

    async def pnl_stream_loop(self):
        # We need a reference to the latest price, mock for now
        mock_price = 1.1005
        while True:
            for pos in self.positions.positions:
                current_pnl = self.pnl.calculate(pos, mock_price)
                await self.events.publish_pnl({
                    "position_id": pos["id"],
                    "pnl": current_pnl
                })
            await asyncio.sleep(1)

