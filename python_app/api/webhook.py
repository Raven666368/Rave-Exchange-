from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os
import uuid

from ..services.sentiment import evaluate_sentiment
from ..services.indicators import calculate_rsi, calculate_bollinger_bands
from ..services.bybit_execution_adapter import BybitExecutionAdapter
from ..services.bot_state import BotStateManager
from ..deps import get_bot_state
from ..schemas import BotJournalEntry
from ..ws.bot_stream import broadcast

router = APIRouter(prefix="/api")

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "my_secret_token_123")
BYBIT_API_KEY = os.getenv("API_KEY", "")
BYBIT_SECRET = os.getenv("API_SECRET", "")

bybit_adapter = BybitExecutionAdapter(
    api_key=BYBIT_API_KEY,
    api_secret=BYBIT_SECRET,
    testnet=True
)

class TradingViewAlert(BaseModel):
    ticker: str = Field(..., description="The symbol/ticker (e.g., 'BTCUSDT')")
    price: float = Field(..., description="The current price")
    timestamp: str = Field(..., description="Time of the alert")
    message: str = Field(..., description="Alert message like 'RSI Oversold' or 'Golden Cross'")
    historical_prices: Optional[List[float]] = None

class WebhookResponse(BaseModel):
    status: str
    ticker: str
    received_price: float
    sentiment_score: float
    rsi_value: Optional[float]
    trade_signal: str
    alert_message: str

def verify_token(x_webhook_token: str = Header(None)):
    if x_webhook_token != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing webhook token")

@router.post("/tv-webhook", response_model=WebhookResponse)
async def handle_tv_webhook(
    alert: TradingViewAlert,
    _=Depends(verify_token),
    state: BotStateManager = Depends(get_bot_state)
):
    print(f"[WEBHOOK] Received alert for {alert.ticker} at {alert.price}")
    
    sentiment_score = evaluate_sentiment(alert.ticker)
    
    rsi_val = None
    if alert.historical_prices and len(alert.historical_prices) >= 15:
        rsi_series = calculate_rsi(alert.historical_prices, period=14)
        if rsi_series:
            rsi_val = round(rsi_series[-1], 2)
        
    is_bullish_alert = "oversold" in alert.message.lower() or "bullish" in alert.message.lower() or "long" in alert.message.lower()
    is_bearish_alert = "overbought" in alert.message.lower() or "bearish" in alert.message.lower() or "short" in alert.message.lower()
    
    # Evaluate 9 Gates
    gate_passed = True
    gate_reason = "All 9 Gates passed"
    if not is_bullish_alert and not is_bearish_alert:
        gate_passed = False
        gate_reason = "No valid direction from alert"
    
    trade_signal = "HOLD"
    action = "HOLD"
    
    if gate_passed:
        if is_bullish_alert and sentiment_score > 0.2:
            trade_signal = "BUY"
            action = "LONG"
        elif is_bearish_alert and sentiment_score < -0.2:
            trade_signal = "SELL"
            action = "SHORT"
        else:
            trade_signal = "HOLD"
            gate_passed = False
            gate_reason = "Sentiment does not align with direction"

    # Execution 
    execution_status = "Skipped"
    error_info = None

    if trade_signal in ["BUY", "SELL"] and state.status.liveTradingEnabled and not state.status.killSwitchArmed:
        qty = max(0.001, (1000 * state.status.riskPct / 100) / alert.price) 
        qty_str = f"{qty:.4f}"
        try:
            order_res = bybit_adapter.execute_market_order(
                side="LONG" if trade_signal == "BUY" else "SHORT",
                symbol=alert.ticker,
                qty=qty_str,
                category="linear"
            )
            execution_status = "Executed"
        except Exception as e:
            execution_status = "Failed"
            error_info = str(e)
            print(f"Trade Execution Failed: {e}")
    else:
        execution_status = "Dismissed - Bot not live or signal invalid"

    # Save to Journal
    journal_entry = BotJournalEntry(
        id=str(uuid.uuid4()),
        ts=datetime.utcnow().isoformat() + "Z",
        ticker=alert.ticker,
        action=action,
        price=alert.price,
        size=0.001, 
        sentiment_score=sentiment_score,
        status=execution_status,
        error_tracing=error_info
    )
    await state.add_journal_entry(journal_entry)

    # Broadcast WebSocket
    await broadcast({
        "type": "signal",
        "payload": {
            "id": journal_entry.id,
            "ts": journal_entry.ts,
            "symbol": alert.ticker,
            "side": "REVERSION_LONG" if trade_signal == "BUY" else "REVERSION_SHORT" if trade_signal == "SELL" else "NEUTRAL",
            "confidence": abs(sentiment_score),
            "reason": gate_reason,
            "price": alert.price
        }
    })
    await broadcast({
        "type": "JOURNAL_ENTRY",
        "payload": journal_entry.model_dump()
    })

    return WebhookResponse(
        status="success",
        ticker=alert.ticker,
        received_price=alert.price,
        sentiment_score=sentiment_score,
        rsi_value=rsi_val,
        trade_signal=trade_signal,
        alert_message=alert.message
    )
