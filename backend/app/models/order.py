from pydantic import BaseModel, Field
from app.models.enums import OrderType, Side, OrderStatus
from typing import Optional
import uuid

class Order(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    symbol: str
    side: Side
    type: OrderType
    volume: float
    price: Optional[float] = None
    sl: Optional[float] = None
    tp: Optional[float] = None
    status: OrderStatus = OrderStatus.CREATED
