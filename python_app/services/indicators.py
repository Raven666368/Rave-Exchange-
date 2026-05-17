import math
from typing import List, Tuple

def calculate_sma(prices: List[float], period: int) -> List[float]:
    if len(prices) < period:
        return []
    
    sma = []
    # Calculate initial window manually
    current_sum = sum(prices[:period])
    sma.append(current_sum / period)
    
    # Sliding window
    for i in range(period, len(prices)):
        current_sum = current_sum - prices[i - period] + prices[i]
        sma.append(current_sum / period)
        
    return sma

def calculate_bollinger_bands(prices: List[float], period: int = 20, multiplier: float = 2.0) -> Tuple[List[float], List[float], List[float]]:
    """
    Returns (upper_bands, middle_bands, lower_bands)
    """
    if len(prices) < period:
        return [], [], []

    middle_bands = calculate_sma(prices, period)
    upper_bands = []
    lower_bands = []
    
    for i in range(len(middle_bands)):
        window = prices[i : i + period]
        mean = middle_bands[i]
        # Calculate standard deviation
        variance = sum((x - mean) ** 2 for x in window) / period
        std_dev = math.sqrt(variance)
        
        upper_bands.append(mean + (multiplier * std_dev))
        lower_bands.append(mean - (multiplier * std_dev))
        
    return upper_bands, middle_bands, lower_bands

def calculate_rsi(prices: List[float], period: int = 14) -> List[float]:
    """
    Calculates 14-period RSI using Wilder's Smoothing.
    """
    if len(prices) < period + 1:
        return []
        
    rsi = []
    
    # Calculate initial average gain and loss
    gains = 0.0
    losses = 0.0
    
    for i in range(1, period + 1):
        change = prices[i] - prices[i-1]
        if change > 0:
            gains += change
        else:
            losses += abs(change)
            
    avg_gain = gains / period
    avg_loss = losses / period
    
    if avg_loss == 0:
        rs = float('inf')
        rsi.append(100.0)
    else:
        rs = avg_gain / avg_loss
        rsi.append(100.0 - (100.0 / (1.0 + rs)))
        
    # Smoothed calculation for the rest
    for i in range(period + 1, len(prices)):
        change = prices[i] - prices[i-1]
        gain = change if change > 0 else 0.0
        loss = abs(change) if change < 0 else 0.0
        
        avg_gain = ((avg_gain * (period - 1)) + gain) / period
        avg_loss = ((avg_loss * (period - 1)) + loss) / period
        
        if avg_loss == 0:
            rsi.append(100.0)
        else:
            rs = avg_gain / avg_loss
            rsi.append(100.0 - (100.0 / (1.0 + rs)))
            
    return rsi
