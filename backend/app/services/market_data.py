import asyncio
import ccxt.pro as ccxt
import logging
from typing import Dict, Any, Callable, List

logger = logging.getLogger(__name__)

class BybitMarketDataStream:
    def __init__(self, use_testnet: bool = True):
        self.client = ccxt.bybit({
            'enableRateLimit': True,
            'options': {
                'defaultType': 'swap',
            }
        })
        if use_testnet:
            self.client.set_sandbox_mode(True)
            
        self.ticks: Dict[str, Any] = {}
        self.orderbooks: Dict[str, Any] = {}
        self.callbacks: List[Callable] = []

    def subscribe(self, callback: Callable):
        """Subscribe to all stream updates."""
        self.callbacks.append(callback)
        
    async def _notify_callbacks(self, data_type: str, symbol: str, data: Any):
        for cb in self.callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(data_type, symbol, data)
                else:
                    cb(data_type, symbol, data)
            except Exception as e:
                logger.error(f"Error in callback notification: {e}")

    async def watch_ticker(self, symbol: str):
        """Continuously watch ticker updates for a symbol."""
        while True:
            try:
                ticker = await self.client.watch_ticker(symbol)
                self.ticks[symbol] = ticker
                await self._notify_callbacks("ticker", symbol, ticker)
            except ccxt.NetworkError as e:
                logger.warning(f"Bybit Network Error watching ticker for {symbol}: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Bybit WebSocket Error (ticker {symbol}): {e}")
                await asyncio.sleep(5)

    async def watch_order_book(self, symbol: str):
        """Continuously watch order book updates for a symbol."""
        while True:
            try:
                orderbook = await self.client.watch_order_book(symbol)
                self.orderbooks[symbol] = orderbook
                await self._notify_callbacks("orderbook", symbol, orderbook)
            except ccxt.NetworkError as e:
                logger.warning(f"Bybit Network Error watching orderbook for {symbol}: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Bybit WebSocket Error (orderbook {symbol}): {e}")
                await asyncio.sleep(5)

    async def watch_trades(self, symbol: str):
        """Continuously watch recent trades updates for a symbol."""
        while True:
            try:
                trades = await self.client.watch_trades(symbol)
                await self._notify_callbacks("trades", symbol, trades)
            except ccxt.NetworkError as e:
                logger.warning(f"Bybit Network Error watching trades for {symbol}: {e}. Reconnecting in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Bybit WebSocket Error (trades {symbol}): {e}")
                await asyncio.sleep(5)

    async def start_streams(self, symbols: List[str]):
        """Helper method to start multiple streams concurrently."""
        tasks = []
        for symbol in symbols:
            tasks.append(asyncio.create_task(self.watch_ticker(symbol)))
            tasks.append(asyncio.create_task(self.watch_order_book(symbol)))
            tasks.append(asyncio.create_task(self.watch_trades(symbol)))
        return tasks

    async def close(self):
        """Close the ccxt pro connection."""
        await self.client.close()
