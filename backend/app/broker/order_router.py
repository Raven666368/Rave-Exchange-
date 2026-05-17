class OrderRouter:

    def __init__(self, brokers):
        self.brokers = brokers

    async def route(self, order):
        symbol = order.symbol if hasattr(order, 'symbol') else getattr(order, 'symbol', order.get('symbol', 'BTCUSDT'))

        if symbol in ["BTCUSDT", "ETHUSDT"]:
            if "bybit" in self.brokers:
                return await self.brokers["bybit"].place_order(order)
            else:
                return {"error": "bybit broker not configured"}

        if symbol in ["EURUSD", "GBPUSD"]:
            if "mt5" in self.brokers:
                return await self.brokers["mt5"].place_order(order)
            else:
                return {"error": "mt5 broker not configured"}

        # default to bybit
        if "bybit" in self.brokers:
            return await self.brokers["bybit"].place_order(order)

        raise Exception(f"No broker found for symbol {symbol}")
