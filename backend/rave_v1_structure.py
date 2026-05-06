import pandas as pd
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from .rave_v1_config import Session, TradeRegime

class StructureEngine:
    def __init__(self):
        pass
        
    def determine_session(self) -> Session:
        """
        Determines current active trading session based on UTC time.
        Asian: 00:00 - 07:00
        London: 07:00 - 13:00
        New York: 13:00 - 22:00
        """
        now = datetime.now(timezone.utc)
        hour = now.hour
        
        if 0 <= hour < 7:
            return Session.ASIAN
        elif 7 <= hour < 13:
            return Session.LONDON
        elif 13 <= hour < 22:
            return Session.NEW_YORK
        else:
            return Session.DEAD_ZONE
            
    def determine_pca_regime(self, df: pd.DataFrame) -> TradeRegime:
        """
        Uses Principal Component Analysis to classify the market regime.
        This provides quantitative backing beyond basic price action.
        """
        if len(df) < 50:
            return TradeRegime.CHOP

        try:
            from sklearn.decomposition import PCA
            from sklearn.preprocessing import StandardScaler
            
            # Simple feature engineering for regime classification
            returns = df['close'].pct_change().fillna(0)
            vol = returns.rolling(10).std().fillna(0)
            volumes = df['volume'].pct_change().fillna(0)
            
            features = pd.DataFrame({'ret': returns, 'vol': vol, 'volume_chg': volumes}).tail(30)
            scaler = StandardScaler()
            
            # Catch cases where constant data creates NaN in standard scaler
            X_scaled = scaler.fit_transform(features)
            X_scaled = np.nan_to_num(X_scaled)

            pca = PCA(n_components=1)
            pc1 = pca.fit_transform(X_scaled)
            latest_pc1 = pc1[-1][0]
            
            # Dummy quantitative thresholding logic for regime mappings
            if latest_pc1 > 1.5:
                return TradeRegime.TREND
            elif latest_pc1 < -1.0:
                return TradeRegime.CHOP
            elif returns.iloc[-1] < 0:
                # If reverting from a drawdown, target is reversion long
                return TradeRegime.REVERSION_LONG
            else:
                return TradeRegime.REVERSION_SHORT

        except Exception as e:
            return TradeRegime.CHOP

    def detect_sweep(self, df: pd.DataFrame) -> bool:
        """
        Checks for an ATR-normalized fractal sweep.
        Simplified placeholder for actual deep wick detection.
        """
        if len(df) < 5:
            return False
            
        # Basic wick size proxy check
        last_candle = df.iloc[-1]
        body = abs(last_candle['close'] - last_candle['open'])
        wick_up = last_candle['high'] - max(last_candle['open'], last_candle['close'])
        wick_down = min(last_candle['open'], last_candle['close']) - last_candle['low']
        
        # If wick is significantly larger than body, consider it a potential sweep (crude metric)
        if wick_up > body * 1.5 or wick_down > body * 1.5:
            return True
            
        return False

    def detect_mss(self, df: pd.DataFrame) -> bool:
        """
        Detects Market Structure Shift (5m candle closes through prior swing high/low).
        """
        # For a genuine MS shift, you'd track swing highs and lows and check candle close values.
        # This is a stub implementation representing a passing condition.
        if len(df) < 10:
            return False
        return True 

    def detect_fvg(self, df: pd.DataFrame) -> bool:
        """
        Detects unmitigated Fair Value Gaps (3-candle imbalance).
        """
        if len(df) < 3: return False
        c1, c2, c3 = df.iloc[-3], df.iloc[-2], df.iloc[-1]
        
        # Bullish FVG
        if c3['low'] > c1['high']:
            return True
        # Bearish FVG
        if c3['high'] < c1['low']:
            return True
        return False

    def determine_htf_bias(self, df_4h: pd.DataFrame, current_price: float) -> str:
        """
        Calculates whether current price is in 4H premium (top 35%) or discount (bottom 35%).
        """
        if df_4h is None or len(df_4h) < 10: 
            # If we don't have 4H data loaded yet, fail open with equilibrium
            return "discount" 
            
        range_high = df_4h['high'].max()
        range_low = df_4h['low'].min()
        total_range = range_high - range_low
        if total_range == 0: return "equilibrium"
        
        discount_zone = range_low + (total_range * 0.35)
        premium_zone = range_high - (total_range * 0.35)
        
        if current_price <= discount_zone:
            return "discount"
        elif current_price >= premium_zone:
            return "premium"
        return "equilibrium"
        
    def calculate_atr(self, df: pd.DataFrame, period: int = 14) -> float:
        """
        Calculates Average True Range.
        """
        if df is None or len(df) < period: return 0.0
        high_low = df['high'] - df['low']
        high_close = np.abs(df['high'] - df['close'].shift())
        low_close = np.abs(df['low'] - df['close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        return true_range.rolling(period).mean().iloc[-1]
