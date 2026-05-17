from dataclasses import dataclass
from typing import Literal, Optional

from pybit.unified_trading import HTTP


TradeSide = Literal["LONG", "SHORT"]
OrderSide = Literal["Buy", "Sell"]


@dataclass
class BybitOrderResult:
    orderId: str
    orderLinkId: str = ""


class BybitExecutionAdapter:
    def __init__(
        self,
        api_key: str,
        api_secret: str,
        testnet: bool = True,
        recv_window: int = 5000,
    ):
        self.client = HTTP(
            testnet=testnet,
            api_key=api_key,
            api_secret=api_secret,
            recv_window=recv_window,
        )

    def _map_side(self, side: TradeSide) -> OrderSide:
        return "Buy" if side == "LONG" else "Sell"

    def execute_market_order(
        self,
        *,
        side: TradeSide,
        symbol: str,
        qty: str,
        category: str = "linear",
        reduce_only: bool = False,
        position_idx: int = 0,
        order_link_id: Optional[str] = None,
    ) -> BybitOrderResult:
        response = self.client.place_order(
            category=category,
            symbol=symbol,
            side=self._map_side(side),
            orderType="Market",
            qty=qty,
            timeInForce="IOC",
            reduceOnly=reduce_only,
            positionIdx=position_idx,
            orderLinkId=order_link_id or "",
        )

        result = response.get("result") or {}
        order_id = result.get("orderId")
        if not order_id:
            raise RuntimeError(f"Bybit order rejected: {response}")

        return BybitOrderResult(
            orderId=order_id,
            orderLinkId=result.get("orderLinkId", "") or "",
        )
