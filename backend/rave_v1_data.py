import asyncio
import ccxt.pro as ccxt
import pandas as pd
from typing import Dict, List
import logging
from .rave_v1_config import CONFIG

logger = logging.getLogger(__name__)

class DataStore:
    def __init__(self):
        self.bybit = ccxt.bybit({
            'apiKey': CONFIG.bybit_api_key,
            'secret': CONFIG.bybit_api_secret,
            'enableRateLimit': True,
            'options': {
                'defaultType': 'swap',
            }
        })
        if CONFIG.testnet:
            self.bybit.set_sandbox_mode(True)
            
        self.binance = ccxt.binance({
            'enableRateLimit': True,
        })
        
        self.candles: Dict[str, Dict[str, pd.DataFrame]] = {}
        self.latest_prices: Dict[str, Dict[str, float]] = {}
        self.latest_orderbooks: Dict[str, Dict] = {}

    async def initialize(self):
        logger.info("Initializing DataStore...")
        await self.bybit.load_markets()
        await self.binance.load_markets()
        logger.info("Markets loaded.")
        
    async def start_market_streams(self, symbols: tuple):
        """Starts background tasks to fetch real-time tickers and orderbooks for all configured symbols."""
        tasks = []
        for sym in symbols:
            tasks.append(asyncio.create_task(self.watch_ticker_bybit(sym)))
            tasks.append(asyncio.create_task(self.watch_order_book_bybit(sym)))
            tasks.append(asyncio.create_task(self.watch_ticker_binance(sym)))
        return tasks

    async def fetch_ohlcv(self, symbol: str, timeframe: str = '5m', limit: int = 200):
        try:
            ohlcv = await self.bybit.fetch_ohlcv(symbol, timeframe, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            df.set_index('timestamp', inplace=True)
            
            if symbol not in self.candles:
                self.candles[symbol] = {}
            self.candles[symbol][timeframe] = df
            
            return df
        except Exception as e:
            logger.error(f"Error fetching OHLCV for {symbol} ({timeframe}): {e}")
            return None

    async def watch_ticker_bybit(self, symbol: str):
        while True:
            try:
                ticker = await self.bybit.watch_ticker(symbol)
                if symbol not in self.latest_prices:
                    self.latest_prices[symbol] = {}
                self.latest_prices[symbol]['bybit'] = ticker['last']
            except ccxt.NetworkError as e:
                logger.error(f"Bybit Network Error: {e}, Retrying in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Bybit WebSocket Error: {e}")
                await asyncio.sleep(5)

    async def watch_order_book_bybit(self, symbol: str):
        while True:
            try:
                orderbook = await self.bybit.watch_order_book(symbol)
                self.latest_orderbooks[symbol] = orderbook
            except ccxt.NetworkError as e:
                logger.error(f"Bybit OB Network Error: {e}, Retrying in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Bybit OB WebSocket Error: {e}")
                await asyncio.sleep(5)

    async def watch_ticker_binance(self, symbol: str):
        # Format for CCXT binance is usually BASE/QUOTE for spot
        binance_symbol = symbol.replace("USDT", "/USDT")
        if binance_symbol == symbol:
            binance_symbol = f"{symbol[:3]}/{symbol[3:]}"
            
        while True:
            try:
                ticker = await self.binance.watch_ticker(binance_symbol)
                if symbol not in self.latest_prices:
                    self.latest_prices[symbol] = {}
                self.latest_prices[symbol]['binance'] = ticker['last']
            except ccxt.NetworkError as e:
                logger.error(f"Binance Network Error at {binance_symbol}: {e}, Retrying in 5s...")
                await asyncio.sleep(5)
            except Exception as e:
                logger.error(f"Binance WebSocket Error: {e}")
                await asyncio.sleep(5)

    def get_spread(self, symbol: str) -> float:
        prices = self.latest_prices.get(symbol, {})
        if 'bybit' in prices and 'binance' in prices:
            p1, p2 = prices['bybit'], prices['binance']
            if p1 == 0: return 999.0
            return abs(p1 - p2) / p1 * 100
        return 999.0

    def get_current_price(self, symbol: str) -> float:
        """Helper to get the most recent price from Bybit or Binance fallback."""
        prices = self.latest_prices.get(symbol, {})
        return prices.get('bybit') or prices.get('binance') or 0.0

    def get_dataframe(self, symbol: str, timeframe: str = '5m') -> pd.DataFrame:
        """Helper to retrieve the latest candle dataframe for a specific symbol and timeframe."""
        symbol_data = self.candles.get(symbol, {})
        return symbol_data.get(timeframe) or pd.DataFrame()

    async def close(self):
        await self.bybit.close()
        await self.binance.close()
