class PositionEngine:
    def __init__(self):
        self.positions = []

    def open_position(self, order, price):
        position = {
            "id": order.id,
            "symbol": order.symbol,
            "side": order.side,
            "entry": price,
            "volume": order.volume
        }
        self.positions.append(position)
        return position
