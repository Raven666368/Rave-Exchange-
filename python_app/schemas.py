from pydantic import BaseModel
from typing import Optional, Literal, List

class BotStatus(BaseModel):
    liveTradingEnabled: bool
    mode: Literal["PAPER", "TESTNET", "LIVE"]
    killSwitchArmed: bool
    connected: bool
    lastSync: Optional[str]
    currentSymbol: str
    currentPrice: float
    currentVolume24h: float
    spread: float
    riskPct: float

class BotSignal(BaseModel):
    id: str
    ts: str
    symbol: str
    side: Literal["REVERSION_LONG", "REVERSION_SHORT", "NEUTRAL"]
    confidence: float
    reason: str
    price: Optional[float] = None

class BotKillSwitch(BaseModel):
    armed: bool
    updatedAt: str

class BotConfig(BaseModel):
    liveTradingEnabled: bool
    riskPct: float
    apiKeyConfigured: bool

class BotJournalEntry(BaseModel):
    id: str
    ts: str
    ticker: str
    action: str
    price: float
    size: float
    sentiment_score: float
    status: str
    error_tracing: Optional[str] = None

class BotStreamEnvelope(BaseModel):
    type: Literal["signal", "status", "pong", "error"]
    payload: dict
