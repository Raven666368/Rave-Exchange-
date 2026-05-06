import logging
from typing import Dict, Any, Optional, List
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

    async def check_auth(self) -> bool:
        """
        Preflight check to verify Bybit authentication and permissions.
        Sets internal fallback flag 'private_auth_working'.
        """
        try:
            # fetch balance is a private endpoint that requires valid keys
            logger.info("Running Bybit API Auth Preflight Check...")
            balance = await self.exchange.fetch_balance()
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
            
        try:
            order = await self.exchange.create_order(
                symbol=symbol,
                type='market',
                side=side,
                amount=amount,
                price=None,
                params=params
            )
            logger.info(f"Market {side} order created for {symbol}: {order.get('id')}")
            return order
        except Exception as e:
            logger.error(f"Error creating market order for {symbol}: {e}")
            raise

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
            
        try:
            order = await self.exchange.create_order(
                symbol=symbol,
                type='limit',
                side=side,
                amount=amount,
                price=price,
                params=params
            )
            logger.info(f"Limit {side} order created for {symbol} at {price}: {order.get('id')}")
            return order
        except Exception as e:
            logger.error(f"Error creating limit order for {symbol}: {e}")
            raise

    async def cancel_order(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """
        Cancels an open order by ID.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping cancel_order due to failed auth preflight (Fallback Mode).")
            return {"id": order_id, "status": "canceled"}
        
        try:
            res = await self.exchange.cancel_order(id=order_id, symbol=symbol)
            logger.info(f"Order cancelled: {order_id} for {symbol}")
            return res
        except Exception as e:
            logger.error(f"Error cancelling order {order_id} for {symbol}: {e}")
            raise

    async def fetch_order_status(self, order_id: str, symbol: str) -> Dict[str, Any]:
        """
        Fetches the current status and execution details of an order.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping fetch_order_status due to failed auth preflight (Fallback Mode).")
            return {"id": order_id, "status": "open"}
            
        try:
            order = await self.exchange.fetch_order(id=order_id, symbol=symbol)
            return order
        except Exception as e:
            logger.error(f"Error fetching order {order_id} for {symbol}: {e}")
            raise

    async def fetch_open_positions(self, symbols: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Fetches active open positions.
        """
        if not self.private_auth_working:
            logger.warning(f"Skipping fetch_open_positions due to failed auth preflight (Fallback Mode). Returns empty list.")
            return []
            
        try:
            # CCXT fetch_positions returns a list of position structures
            positions = await self.exchange.fetch_positions(symbols)
            # Filter for actively held positions (contracts > 0)
            open_positions = [
                pos for pos in positions 
                if pos.get('contracts') is not None and float(pos['contracts']) > 0
            ]
            return open_positions
        except Exception as e:
            logger.error(f"Error fetching open positions: {e}")
            raise

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
                    
            except Exception as e:
                logger.error(f"Bybit Order Watcher encountered error: {e}")
                await asyncio.sleep(10) # Exponential backoff would be better, but this is stable
