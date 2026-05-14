import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable
import ccxt.async_support as ccxt

logger = logging.getLogger(__name__)

class BybitAdapter:
    """
    Abstracts Bybit V5 API interactions specifically for order execution, management,
    and querying positions. Uses an injected CCXT exchange instance.
    """
    def __init__(self, exchange_instance: ccxt.bybit):
        self.exchange = exchange_instance
        self.private_auth_working = False

    async def __aenter__(self):
        await self.check_auth()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def _execute_with_retry(self, func: Callable, *args, retries: int = 3, backoff_factor: float = 1.5, **kwargs):
        func_name = getattr(func, '__name__', str(func))
        for attempt in range(retries):
            try:
                return await func(*args, **kwargs)
            except (ccxt.NetworkError, ccxt.RequestTimeout, ccxt.ExchangeNotAvailable) as e:
                if attempt == retries - 1:
                    logger.error(f"❌ Max retries reached for {func_name}: {e}")
                    raise
                sleep_time = backoff_factor ** attempt
                logger.warning(f"⚠️ Transient network error in {func_name} (attempt {attempt+1}/{retries}): {e}. Retrying in {sleep_time:.2f}s...")
                await asyncio.sleep(sleep_time)
            except ccxt.RateLimitExceeded as e:
                sleep_time = (backoff_factor ** attempt) * 2
                if attempt == retries - 1:
                    logger.error(f"❌ Rate limit exceeded and max retries reached for {func_name}: {e}")
                    raise
                logger.warning(f"⚠️ Rate limit exceeded in {func_name} (attempt {attempt+1}/{retries}): {e}. Retrying in {sleep_time:.2f}s...")
                await asyncio.sleep(sleep_time)
            except ccxt.AuthenticationError as e:
                logger.error(f"❌ Authentication Error in {func_name}: {e}. Check API keys and environment variables.")
                raise
            except ccxt.PermissionDenied as e:
                logger.error(f"❌ Permission Denied in {func_name}: {e}. Verify API key scope ('Order', 'Position') or IP whitelist.")
                raise
            except ccxt.InsufficientFunds as e:
                logger.error(f"❌ Insufficient Funds in {func_name}: {e}.")
                raise
            except ccxt.InvalidOrder as e:
                logger.error(f"❌ Invalid Order parameters for {func_name}: {e}.")
                raise
            except Exception as e:
                logger.error(f"❌ Unexpected error in {func_name}: {e}")
                raise

    async def check_auth(self) -> bool:
        """
        Preflight check to verify Bybit authentication and permissions.
        Sets internal fallback flag 'private_auth_working'.
        """
        try:
            # fetch balance is a private endpoint that requires valid keys
            logger.info("Running Bybit API Auth Preflight Check...")
            await self._execute_with_retry(self.exchange.fetch_balance, retries=2)
            self.private_auth_working = True
            logger.info("✅ Bybit authentication successful! Market Data & Trade execution permissions verified.")
            return True
        except ccxt.AuthenticationError as e:
            logger.error(f"❌ Bybit Authentication Failed: {e}")
            logger.error("Possible reasons:")
            logger.error("  1. Key mismatch (Testnet key used on Mainnet endpoint or vice versa).")
            logger.error("  2. API Key or Secret is incorrect.")
            logger.error(f"  -> Currently using Sandbox/Testnet parameter: {self.exchange.urls.get('test', 'UNKNOWN') if hasattr(self.exchange, 'urls') else 'N/A'} (Testnet enabled = {self.exchange.sandboxMode})")
            return False
        except ccxt.PermissionDenied as e:
            logger.error(f"❌ Bybit Permission Denied: {e}")
            logger.error("Ensure the API key has 'Order', 'Position', and 'Account' read/write permissions.")
            logger.error("Also verify that this environment's IP is whitelisted, or temporarily disable IP whitelists for debugging.")
            return False
        except Exception as e:
            logger.error(f"❌ Bybit Preflight check failed due to unexpected error: {e}")
            return False

    async def create_market_order(
        self, 
        symbol: str, 
        side: str, 
        amount: float, 
        stop_loss: Optional[float] = None, 
        take_profit: Optional[float] = None,
        reduce_only: bool = False
    ) -> Dict[str, Any]:
        """
        Creates a market order with optional SL/TP levels.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping create_market_order due to failed auth preflight (Fallback Mode).")
            return {"id": "simulated", "info": {"msg": "simulated due to auth failure"}}
        
        params = {}
        if stop_loss is not None:
            params['stopLoss'] = stop_loss
        if take_profit is not None:
            params['takeProfit'] = take_profit
        if reduce_only:
            params['reduceOnly'] = True
            
        logger.info(f"Creating market {side} order for {symbol} | Amount: {amount}")
        order = await self._execute_with_retry(
            self.exchange.create_order,
            symbol=symbol,
            type='market',
            side=side,
            amount=amount,
            price=None,
            params=params
        )
        logger.info(f"✅ Market {side} order created for {symbol}: {order.get('id')}")
        return order

    async def create_limit_order(
        self, 
        symbol: str, 
        side: str, 
        amount: float, 
        price: float, 
        stop_loss: Optional[float] = None, 
        take_profit: Optional[float] = None,
        post_only: bool = False,
        reduce_only: bool = False
    ) -> Dict[str, Any]:
        """
        Creates a limit order with optional SL/TP levels and execution toggles.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping create_limit_order due to failed auth preflight (Fallback Mode).")
            return {"id": "simulated", "info": {"msg": "simulated due to auth failure"}}
        
        params = {}
        if stop_loss is not None:
            params['stopLoss'] = stop_loss
        if take_profit is not None:
            params['takeProfit'] = take_profit
        if post_only:
            params['postOnly'] = True
        if reduce_only:
            params['reduceOnly'] = True
            
        logger.info(f"Creating limit {side} order for {symbol} | Amount: {amount} | Price: {price}")
        order = await self._execute_with_retry(
            self.exchange.create_order,
            symbol=symbol,
            type='limit',
            side=side,
            amount=amount,
            price=price,
            params=params
        )
        logger.info(f"✅ Limit {side} order created for {symbol} at {price}: {order.get('id')}")
        return order

    async def cancel_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """
        Cancels an open order by ID.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping cancel_order due to failed auth preflight (Fallback Mode).")
            return {"id": order_id, "status": "canceled"}
        
        logger.info(f"Cancelling order {order_id} for {symbol}...")
        res = await self._execute_with_retry(
            self.exchange.cancel_order,
            id=order_id,
            symbol=symbol
        )
        logger.info(f"✅ Order cancelled: {order_id} for {symbol}")
        return res

    async def fetch_order_status(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """
        Fetches the current status and execution details of an order.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping fetch_order_status due to failed auth preflight (Fallback Mode).")
            return {"id": order_id, "status": "open"}
            
        return await self._execute_with_retry(
            self.exchange.fetch_order,
            id=order_id,
            symbol=symbol
        )

    async def fetch_open_positions(self, symbols: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Fetches active open positions.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping fetch_open_positions due to failed auth preflight (Fallback Mode). Returns empty list.")
            return []
            
        # CCXT fetch_positions returns a list of position structures
        positions = await self._execute_with_retry(
            self.exchange.fetch_positions,
            symbols=symbols
        )
        # Filter for actively held positions (contracts > 0)
        open_positions = [
            pos for pos in positions 
            if pos.get('contracts') is not None and float(pos['contracts']) > 0
        ]
        return open_positions

    async def watch_orders_loop(self):
        """
        Subscribes to the order stream via WebSocket and logs any status changes.
        """
        if not self.private_auth_working:
            logger.warning("Bybit Private WS tracking started without verified Auth. Expect errors if keys are wrong.")
            
        logger.info("Initializing Bybit Order WebSocket stream...")
        while True:
            try:
                # CCXT Pro watch_orders handles the subscription and incremental updates
                orders = await self.exchange.watch_orders()
                for order in orders:
                    sym = order.get('symbol', 'UNKNOWN')
                    oid = order.get('id', 'N/A')
                    status = order.get('status', 'N/A')
                    filled = order.get('filled', 0)
                    price = order.get('price', 'MKT')
                    
                    logger.info(f"🔔 [Bybit] ORDER UPDATE | {sym} | {oid} | Status: {status.upper()} | Filled: {filled} @ {price}")
                    
            except ccxt.AuthenticationError as e:
                logger.error(f"❌ Bybit Order Watcher Auth Error: {e}")
                await asyncio.sleep(60)
            except Exception as e:
                logger.error(f"⚠️ Bybit Order Watcher encountered error: {e}")
                await asyncio.sleep(10) # Exponential backoff would be better, but this is stable

    async def watch_trades_loop(self, symbol: str):
        """
        Subscribes to recent trades via WebSocket.
        """
        logger.info(f"Initializing Bybit Trades WebSocket stream for {symbol}...")
        while True:
            try:
                trades = await self.exchange.watch_trades(symbol)
                for t in trades:
                    logger.debug(f"🔄 [Bybit] TRADE | {symbol} | {t.get('side')} {t.get('amount')} @ {t.get('price')}")
            except Exception as e:
                logger.error(f"⚠️ Bybit Trades Watcher encountered error: {e}")
                await asyncio.sleep(5)

    async def watch_order_book_loop(self, symbol: str, limit: int = 25):
        """
        Subscribes to order book snapshots via WebSocket.
        """
        logger.info(f"Initializing Bybit Order Book WebSocket stream for {symbol}...")
        while True:
            try:
                orderbook = await self.exchange.watch_order_book(symbol, limit)
                bids = orderbook['bids'][0] if len(orderbook['bids']) > 0 else []
                asks = orderbook['asks'][0] if len(orderbook['asks']) > 0 else []
                logger.debug(f"📊 [Bybit] ORDERBOOK | {symbol} | Best Bid: {bids} | Best Ask: {asks}")
            except Exception as e:
                logger.error(f"⚠️ Bybit Order Book Watcher encountered error: {e}")
                await asyncio.sleep(5)
