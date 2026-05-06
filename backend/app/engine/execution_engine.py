class ExecutionEngine:
    def __init__(self):
        from app.engine.risk_engine import RiskEngine
        from app.engine.position_engine import PositionEngine
        from app.engine.state_machine import OrderStateMachine
        from app.engine.order_manager import OrderManager

        self.risk = RiskEngine()
        self.positions = PositionEngine()
        self.sm = OrderStateMachine()
        self.orders = OrderManager(self.risk, self.positions, self.sm)

        self.balance = 10000

    def place_order(self, order, price):
        return self.orders.execute(order, price, self.balance)
