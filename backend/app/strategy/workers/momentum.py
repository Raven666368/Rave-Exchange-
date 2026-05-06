from app.strategy.workers.base import BaseStrategyWorker

class MomentumWorker(BaseStrategyWorker):

    async def on_tick(self, data):
        price = data.get("price")
        rsi = data.get("rsi")

        if rsi is None:
            return None

        if rsi > 60:
            return self.emit_signal("EURUSD", "buy", 0.8)

        if rsi < 40:
            return self.emit_signal("EURUSD", "sell", 0.8)

        return None
