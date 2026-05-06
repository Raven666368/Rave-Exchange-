import os
from datetime import datetime, timezone
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import get_bot_state
from ..services.bot_state import BotState
from ..services.bybit_execution_adapter import BybitExecutionAdapter

router = APIRouter(prefix="/api", tags=["trade"])

TradeSide = Literal["LONG", "SHORT"]


class TradeExecuteRequest(BaseModel):
    side: TradeSide
    symbol: str = Field(min_length=1)
    qty: str = Field(default="0.001", min_length=1) # Note: Adding default as frontend doesn't send qty in current implementation


class TradeExecuteResponse(BaseModel):
    orderId: str
    side: TradeSide
    symbol: str
    status: Literal["accepted", "rejected"]
    ts: str
    brokerOrderId: Optional[str] = None


def get_bybit_adapter() -> BybitExecutionAdapter:
    return BybitExecutionAdapter(
        api_key=os.getenv("BYBIT_API_KEY", ""),
        api_secret=os.getenv("BYBIT_API_SECRET", ""),
        testnet=os.getenv("BYBIT_TESTNET", "true").lower() == "true",
    )


@router.post("/trade/execute", response_model=TradeExecuteResponse)
async def execute_trade(
    payload: TradeExecuteRequest,
    state: BotState = Depends(get_bot_state),
    adapter: BybitExecutionAdapter = Depends(get_bybit_adapter),
):
    if not state.get_config().liveTradingEnabled:
        raise HTTPException(status_code=403, detail="Live trading is disabled")

    if state.kill_switch.armed:
        raise HTTPException(status_code=423, detail="Kill switch is armed")

    ts = datetime.now(timezone.utc).isoformat()
    app_order_id = str(uuid4())

    try:
        broker_result = adapter.execute_market_order(
            side=payload.side,
            symbol=payload.symbol,
            qty=payload.qty,
            category="linear",
            reduce_only=False,
            position_idx=0,
            order_link_id=app_order_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    state.status.currentSymbol = payload.symbol
    state.status.lastSync = ts

    return TradeExecuteResponse(
        orderId=app_order_id,
        side=payload.side,
        symbol=payload.symbol,
        status="accepted",
        ts=ts,
        brokerOrderId=broker_result.orderId,
    )
