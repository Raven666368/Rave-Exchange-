class PnLEngine:
    def calculate(self, position, current_price):
        if position["side"] == "buy":
            return (current_price - position["entry"]) * position["volume"]
        else:
            return (position["entry"] - current_price) * position["volume"]
