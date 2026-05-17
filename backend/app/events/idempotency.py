class IdempotencyStore:
    def __init__(self):
        self.processed = set()

    def already_seen(self, event_id: str):
        return event_id in self.processed

    def mark_seen(self, event_id: str):
        self.processed.add(event_id)
