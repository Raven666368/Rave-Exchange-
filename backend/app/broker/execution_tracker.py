class ExecutionTracker:

    def __init__(self):
        self.orders = {}

    def register(self, order_id, raw_response):
        self.orders[order_id] = {
            "status": "submitted",
            "raw": raw_response
        }

    def update(self, order_id, status):
        if order_id in self.orders:
            self.orders[order_id]["status"] = status
