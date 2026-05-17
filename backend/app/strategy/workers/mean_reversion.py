from app.strategy.workers.base import BaseStrategyWorker

class MeanReversionWorker(BaseStrategyWorker):

    async def on_tick(self, data):
        zscore = data.get("zscore")

        if zscore is None:
            return None

        if zscore > 2:
            return self.emit_signal("EURUSD", "sell", 0.7)

        if zscore < -2:
            return self.emit_signal("EURUSD", "buy", 0.7)

        return None
