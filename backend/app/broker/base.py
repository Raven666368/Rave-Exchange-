class BaseBroker:
    async def place_order(self, order):
        raise NotImplementedError

    async def cancel_order(self, order_id):
        raise NotImplementedError

    async def fetch_positions(self):
        raise NotImplementedError

    async def fetch_orders(self):
        raise NotImplementedError
