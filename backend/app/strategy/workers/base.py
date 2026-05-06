class BaseStrategyWorker:
    def __init__(self, name):
        self.name = name

    async def on_tick(self, data):
        raise NotImplementedError

    def emit_signal(self, symbol, direction, strength):
        return {
            "strategy": self.name,
            "symbol": symbol,
            "decision": direction,
            "strength": strength
        }
