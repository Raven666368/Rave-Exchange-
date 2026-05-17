from app.engine.risk_engine import RiskEngine
from app.engine.position_engine import PositionEngine
from app.engine.state_machine import OrderStateMachine

class OrderManager:
    def __init__(self, risk_engine: RiskEngine, position_engine: PositionEngine, state_machine: OrderStateMachine):
        self.risk = risk_engine
        self.positions = position_engine
        self.sm = state_machine

    def execute(self, order, price, balance):
        self.sm.transition(order, "validated")
        self.risk.validate(order, balance)

        self.sm.transition(order, "filled")
        position = self.positions.open_position(order, price)

        return position
