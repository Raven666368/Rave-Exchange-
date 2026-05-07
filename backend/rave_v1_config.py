import os
import certifi
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional

# Set certifi environment variable for ccxt/aiohttp
os.environ['SSL_CERT_FILE'] = certifi.where()

class TradeRegime(Enum):
    REVERSION_LONG = "REVERSION_LONG"
    REVERSION_SHORT = "REVERSION_SHORT"
    TREND = "TREND"
    CHOP = "CHOP"

class Session(Enum):
    ASIAN = "ASIAN"
    LONDON = "LONDON"
    NEW_YORK = "NEW_YORK"
    DEAD_ZONE = "DEAD_ZONE"

@dataclass
class RiskRules:
    risk_per_trade_pct: float = 1.0
    max_daily_loss_pct: float = 3.0
    max_open_positions: int = 3
    min_rr_ratio: float = 3.0

@dataclass
class GodmodeConfig:
    # Exchange defaults
    bybit_api_key: str = os.getenv("BYBIT_API_KEY", "")
    bybit_api_secret: str = os.getenv("BYBIT_API_SECRET", "")
    testnet: bool = os.getenv("BYBIT_TESTNET", "true").lower() == "true"
    symbols: tuple = ("BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT")
    
    # Telegram webhook configurations
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "")
    telegram_enabled: bool = os.getenv("TELEGRAM_ENABLED", "true").lower() == "true"
    
    # Risk settings
    risk: RiskRules = RiskRules()
    
    # Execution thresholds
    spread_threshold: float = 0.05
    volatility_min: float = 0.10
    volatility_max: float = 3.0
    min_confluent_symbols: int = 2

    # MongoDB Configuration
    mongodb_uri: str = os.getenv("MONGODB_URI", "")
    
    # PostgreSQL Configuration
    postgres_uri: str = os.getenv("POSTGRES_URI", "")

# Singleton config instance
CONFIG = GodmodeConfig()
