class StrategyWorkerCluster:
    def __init__(self, workers, bus):
        self.workers = workers
        self.bus = bus

    async def process_tick(self, tick):

        signals = []

        for worker in self.workers:
            signal = await worker.on_tick(tick)

            if signal:
                signals.append(signal)

        if signals:
            await self.bus.publish("raw_signals", {
                "signals": str(signals) # stringify or json dumps for redis streams
            })
