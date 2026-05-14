import logging
import asyncio
from typing import Dict, Any, List

logger = logging.getLogger("MicrostructureEngine")

class OrderBookNormalizer:
    @staticmethod
    def normalize_book(raw_book: Dict[str, Any], exchange: str) -> Dict[str, Any]:
        """Convert exchange-specific order books into a unified format"""
        bids = raw_book.get('bids', [])
        asks = raw_book.get('asks', [])

        best_bid = float(bids[0][0]) if bids else 0.0
        best_ask = float(asks[0][0]) if asks else 0.0
        
        spread = best_ask - best_bid if best_bid and best_ask else 0.0
        mid_price = (best_ask + best_bid) / 2 if best_bid and best_ask else 0.0

        return {
            "exchange": exchange,
            "best_bid": best_bid,
            "best_ask": best_ask,
            "spread": spread,
            "mid_price": mid_price,
            "bids": bids,
            "asks": asks
        }

class LiquidityAnalyticsEngine:
    def __init__(self):
        # We can store rolling history if needed for anomaly detection
        self.history = {}

    def compute_metrics(self, symbol: str, normalized_book: Dict[str, Any], depth_levels: int = 15) -> Dict[str, Any]:
        bids = normalized_book.get('bids', [])[:depth_levels]
        asks = normalized_book.get('asks', [])[:depth_levels]

        bid_volume = sum([float(level[1]) for level in bids])
        ask_volume = sum([float(level[1]) for level in asks])

        imbalance = (bid_volume / ask_volume) if ask_volume > 0 else float('inf')

        # Simple spread compression detection: if spread is super tight relative to price
        mid_price = normalized_book.get('mid_price', 0.0)
        spread_bps = (normalized_book.get('spread', 0.0) / mid_price * 10000) if mid_price > 0 else 0

        # Depth score could be a normalized representation of liquidity
        # Here we just use crude total volume
        depth_score = bid_volume + ask_volume

        # Sweep / Collapse tracking
        if symbol not in self.history:
            self.history[symbol] = {
                "depth_scores": [],
            }
            
        sym_history = self.history[symbol]
        sym_history["depth_scores"].append(depth_score)
        
        # Keep last 10 scores
        if len(sym_history["depth_scores"]) > 10:
            sym_history["depth_scores"].pop(0)
            
        avg_depth = sum(sym_history["depth_scores"]) / max(1, len(sym_history["depth_scores"]))
        
        # If current depth is significantly lower than average (e.g. 40% drops suddenly)
        depth_collapse = depth_score < (avg_depth * 0.6) and len(sym_history["depth_scores"]) > 5

        # Sweep detected could be calculated by looking at sudden changes in best bid/ask
        sweep_detected = spread_bps > 20.0  # arbitrary example threshold

        return {
            "imbalance": imbalance,
            "spread_bps": spread_bps,
            "depth_score": depth_score,
            "sweep_detected": sweep_detected,
            "depth_collapse": depth_collapse,
            "bid_volume": bid_volume,
            "ask_volume": ask_volume,
            "best_bid": normalized_book.get("best_bid"),
            "best_ask": normalized_book.get("best_ask")
        }

class MarketMicrostructureEngine:
    def __init__(self, data_store):
        self.data_store = data_store
        self.normalizer = OrderBookNormalizer()
        self.analytics = LiquidityAnalyticsEngine()

    def process_orderbook(self, symbol: str) -> Dict[str, Any]:
        """Main entry point to get the microstructure signal for a symbol"""
        raw_ob = self.data_store.latest_orderbooks.get(symbol)
        if not raw_ob:
            return None

        # Normalize Bybit
        norm_ob = self.normalizer.normalize_book(raw_ob, 'bybit')
        
        # Analyze
        metrics = self.analytics.compute_metrics(symbol, norm_ob)
        
        latest_prices = self.data_store.latest_prices.get(symbol, {})
        binance_price = latest_prices.get('binance', 0.0)
        bybit_price = metrics["best_bid"] # approximate with bid or mid
        exchange_divergence_bps = 0.0
        
        if binance_price > 0 and bybit_price > 0:
            exchange_divergence_bps = abs(bybit_price - binance_price) / binance_price * 10000
        
        return {
            "symbol": symbol,
            "imbalance": metrics["imbalance"],
            "spread": norm_ob["spread"],
            "depth_score": metrics["depth_score"],
            "sweep_detected": metrics["sweep_detected"],
            "depth_collapse": metrics["depth_collapse"],
            "exchange_divergence": exchange_divergence_bps,
            "best_bid": metrics["best_bid"],
            "best_ask": metrics["best_ask"],
        }
