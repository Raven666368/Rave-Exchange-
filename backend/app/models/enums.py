from enum import Enum

class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"

class OrderStatus(str, Enum):
    CREATED = "created"
    VALIDATED = "validated"
    FILLED = "filled"
    REJECTED = "rejected"
    CLOSED = "closed"

class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"
