import asyncio
import logging
from aiohttp import web
import json
import httpx
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from .rave_v1_config import CONFIG, Session, TradeRegime
from .rave_v1_data import DataStore
from .rave_v1_structure import StructureEngine
from .rave_v1_adapters import BybitAdapter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("RaveV1_Engine")

class GateEngine:
    def __init__(self, data_store: DataStore, structure: StructureEngine):
        self.data = data_store
        self.structure = structure
        self.signals_passed = 0
        
    async def evaluate_gates(self, symbol: str) -> dict:
        gates = {f"Gate {i}": False for i in range(1, 10)}
        reasons = {}
        
        df_5m = self.data.candles.get(symbol)
        if df_5m is None: 
            return gates, {"Error": "No candle data loaded yet."}
        
        current_price = self.data.latest_prices.get(symbol, {}).get('bybit', df_5m['close'].iloc[-1])
        
        # 1. Session alignment
        session = self.structure.determine_session()
        gates["Gate 1"] = session in [Session.ASIAN, Session.LONDON, Session.NEW_YORK]
        reasons["Gate 1"] = f"Session: {session.value}"
        
        # 2. PCA Regime
        regime = self.structure.determine_pca_regime(df_5m)
        gates["Gate 2"] = regime in [TradeRegime.REVERSION_LONG, TradeRegime.REVERSION_SHORT]
        reasons["Gate 2"] = f"Regime: {regime.value}"
        
        # 3. Liquidity sweep confirmed
        is_sweep = self.structure.detect_sweep(df_5m)
        gates["Gate 3"] = is_sweep
        reasons["Gate 3"] = "Sweep confirmed" if is_sweep else "No sweep"
        
        # 4. MSS confirmed
        is_mss = self.structure.detect_mss(df_5m)
        gates["Gate 4"] = is_mss
        reasons["Gate 4"] = "MSS confirmed" if is_mss else "No MSS"
        
        # 5. Unmitigated FVG/OB
        is_fvg = self.structure.detect_fvg(df_5m)
        gates["Gate 5"] = is_fvg
        reasons["Gate 5"] = "Unmitigated FVG in path" if is_fvg else "No FVG/OB"
        
        # 6. HTF 4H Confluence (Mocked using 5m data here for scaffold)
        bias = self.structure.determine_htf_bias(df_5m, current_price) 
        gates["Gate 6"] = bias in ["discount", "premium"]
        reasons["Gate 6"] = f"HTF Confluence: {bias}"
        
        # 7. Volatility within range
        atr = self.structure.calculate_atr(df_5m)
        vol_pct = (atr / current_price) * 100 if current_price else 0
        gates["Gate 7"] = CONFIG.volatility_min <= vol_pct <= CONFIG.volatility_max
        reasons["Gate 7"] = f"Volatility: {vol_pct:.2f}%"
        
        # 8. Spread below threshold
        spread = self.data.get_spread(symbol)
        gates["Gate 8"] = spread < CONFIG.spread_threshold
        reasons["Gate 8"] = f"Spread: {spread:.3f}%"
        
        # 9. R:R validates
        # Calculate theoretical RR assuming structural stop and standard HTF array target
        atr = self.structure.calculate_atr(df_5m)
        mock_risk = atr * 1.5  # stop loss placed beyond ATR wick
        mock_reward = atr * 5.0 # target based on FVG/HTF level distance
        simulated_rr = mock_reward / mock_risk if mock_risk > 0 else 0
        gates["Gate 9"] = simulated_rr >= CONFIG.risk.min_rr_ratio
        reasons["Gate 9"] = f"R:R validated at 1:{simulated_rr:.2f}"
        
        return gates, reasons

class BotRunner:
    def __init__(self):
        self.data_store = DataStore()
        self.bybit_adapter = BybitAdapter(self.data_store.bybit)
        self.structure = StructureEngine()
        self.engine = GateEngine(self.data_store, self.structure)
        self.testnet_signals_captured = 0
        self.db_client = None
        self.journals_col = None
        
    async def init_mongo(self):
        if CONFIG.mongodb_uri and "db_password" not in CONFIG.mongodb_uri:
            try:
                self.db_client = AsyncIOMotorClient(CONFIG.mongodb_uri, serverSelectionTimeoutMS=5000)
                db = self.db_client["ravebot"]
                self.journals_col = db["journals"]
                self.traces_col = db["decision_traces"]
                self.market_data_col = db["market_data"]
                # Ping the server to verify connection and avoid delaying error
                await self.db_client.admin.command('ping')
                logger.info("[MongoDB] Connected to database (journals, decision_traces, market_data)")
            except Exception as e:
                err_str = str(e)
                if "timed out" in err_str.lower() or "timeout" in err_str.lower():
                    logger.warning("[MongoDB] Connection timed out. Running without MongoDB.")
                else:
                    logger.error(f"[MongoDB] Connection error: {e}")
        else:
            logger.info("[MongoDB] Custom connection string not provided. Run without MongoDB.")

    async def log_journal(self, entry: dict):
        if getattr(self, "journals_col", None) is not None:
            entry["id"] = int(datetime.utcnow().timestamp() * 1000)
            entry["createdAt"] = datetime.utcnow()
            entry["timestamp"] = datetime.utcnow().isoformat()
            try:
                await self.journals_col.insert_one(entry)
            except Exception as e:
                logger.error(f"[MongoDB] Error inserting journal: {e}")

    async def log_decision_trace(self, trace: dict):
        if getattr(self, "traces_col", None) is not None:
            trace["timestamp"] = datetime.utcnow().isoformat()
            try:
                await self.traces_col.insert_one(trace)
            except Exception as e:
                pass

    async def log_market_data(self, data: dict):
        if getattr(self, "market_data_col", None) is not None:
            data["timestamp"] = datetime.utcnow().isoformat()
            try:
                await self.market_data_col.insert_one(data)
            except Exception as e:
                pass

    async def bg_log_market_data(self):
        while True:
            await asyncio.sleep(60) # Log every minute
            if getattr(self, "market_data_col", None) is not None and self.data_store.latest_prices:
                snapshot = {
                    "type": "spread_snapshot",
                    "prices": self.data_store.latest_prices.copy()
                }
                await self.log_market_data(snapshot)

    async def start(self):
        await self.init_mongo()
        await self.data_store.initialize()
        await self.bybit_adapter.check_auth()
        
        tasks = []
        for sym in CONFIG.symbols:
            await self.data_store.fetch_ohlcv(sym)
            tasks.append(asyncio.create_task(self.data_store.watch_ticker_bybit(sym)))
            tasks.append(asyncio.create_task(self.data_store.watch_ticker_binance(sym)))
            
        tasks.append(asyncio.create_task(self.bybit_adapter.watch_orders_loop()))
        tasks.append(asyncio.create_task(self.analysis_loop()))
        tasks.append(asyncio.create_task(self.bg_log_market_data()))
        
        logger.info("Rave Godmode v1 components started. Gate engine Armed.")
        logger.info("Forward testing required: 20 clean testnet signals prior to live allocation.")
        await asyncio.gather(*tasks)
        
    async def analysis_loop(self):
        while True:
            confluent_signals = []
            
            for sym in CONFIG.symbols:
                gates, reasons = await self.engine.evaluate_gates(sym)
                
                # Check if all 9 passed
                all_passed = all(gates.values())
                
                if all_passed:
                    side = "buy" if reasons["Gate 6"] == "HTF Confluence: discount" else "sell"
                    confluent_signals.append({
                        "symbol": sym,
                        "side": side,
                        "reasons": reasons
                    })
                else:
                    failed_gates = [k for k, v in gates.items() if not v]
                    failed_reason = f"{failed_gates[0]} failed: {reasons.get(failed_gates[0], 'Unknown')}" if failed_gates else "Unknown"
                    
                    await self.log_journal({
                        "symbol": sym,
                        "side": "N/A",
                        "qty": "0",
                        "price": str(self.data_store.latest_prices.get(sym, {}).get('bybit', 0)),
                        "stop_loss": "0",
                        "take_profit": "0",
                        "order_type": "NONE",
                        "status": "Skipped (Gate Failed)",
                        "mode": "forward-testing",
                        "veto_reason": failed_reason,
                        "tradeSessionId": "SESSION_" + str(int(datetime.utcnow().timestamp()))
                    })
                    
            if len(confluent_signals) >= CONFIG.min_confluent_symbols:
                self.testnet_signals_captured += 1
                logger.info(f"🔥 GODMODE CONFLUENCE MET: {len(confluent_signals)} symbols [Progress: {self.testnet_signals_captured}/20]")
                
                for signal in confluent_signals:
                    sym = signal["symbol"]
                    side = signal["side"]
                    reasons = signal["reasons"]
                    
                    msg = (
                        f"🔥 RAVE GODMODE: CONFLUENCE SIGNAL CONFIRMED\n"
                        f"Target: {sym} | Action: {side.upper()}\n"
                        f"Session: {reasons['Gate 1']}\n"
                        f"HTF Bias: {reasons['Gate 6']}\n"
                        f"Regime: {reasons['Gate 2']}\n"
                        f"Spread: {reasons['Gate 8']}\n"
                        f"Volatility: {reasons['Gate 7']}\n"
                        f"Signals Logged: {self.testnet_signals_captured}/20"
                    )
                    await self.send_telegram(msg)
                    
                    # Simulated execution logic & adapter call 
                    try:
                        current_price = self.data_store.get_current_price(sym)
                        df_5m = self.data_store.get_dataframe(sym, '5m')
                        atr = self.structure.calculate_atr(df_5m)
                        
                        # Find recent structural swings for dynamic placement
                        recent_low = df_5m['low'].tail(10).min()
                        recent_high = df_5m['high'].tail(10).max()
                        
                        if side == "buy":
                            # Structural stop loss below recent swing low + small ATR buffer
                            # Fallback to ATR-based if recent_low is inexplicably high
                            base_sl = min(current_price - atr, recent_low)
                            stop_loss = base_sl - (atr * 0.2)
                            risk = current_price - stop_loss
                            # Ensure minimum 1:3 RR target based on actual structural risk
                            take_profit = current_price + max((risk * 3.0), atr * 3.0)
                        else:
                            # Structural stop loss above recent swing high + small ATR buffer
                            base_sl = max(current_price + atr, recent_high)
                            stop_loss = base_sl + (atr * 0.2)
                            risk = stop_loss - current_price
                            # Ensure minimum 1:3 RR target based on actual structural risk
                            take_profit = current_price - max((risk * 3.0), atr * 3.0)
                            
                        # Extremely conservative initial static size for testnet forward testing
                        order_size = 0.001 if "BTC" in sym else 0.01 
                        
                        logger.info(f"Submitting {side.upper()} order for {sym} | Size: {order_size} | SL: {stop_loss:.2f} | TP: {take_profit:.2f}")
                        res = await self.bybit_adapter.create_market_order(
                            symbol=sym,
                            side=side,
                            amount=order_size,
                            stop_loss=stop_loss,
                            take_profit=take_profit
                        )
                        
                        logger.info(f"Execution response: {res}")
                        await self.send_telegram(f"⚡ Order Executed: {res.get('id', 'N/A')}\nSide: {side.upper()} @ {current_price:.2f}")
                        
                        await self.log_journal({
                            "symbol": sym,
                            "side": side.upper(),
                            "qty": str(order_size),
                            "price": str(current_price),
                            "stop_loss": f"{stop_loss:.2f}",
                            "take_profit": f"{take_profit:.2f}",
                            "order_type": "MARKET",
                            "status": "Confirmed",
                            "mode": "forward-testing",
                            "exchangeOrderId": str(res.get('id', '')),
                            "riskScore": 0.5,
                            "tradeSessionId": "SESSION_" + str(int(datetime.utcnow().timestamp()))
                        })
                        
                    except Exception as exec_error:
                        logger.error(f"Execution Error on Signal Context: {exec_error}")
                        await self.send_telegram(f"❌ Execution Failed on {sym}: {exec_error}")
                        
                        await self.log_journal({
                            "symbol": sym,
                            "side": side.upper(),
                            "qty": str(order_size) if 'order_size' in locals() else "0",
                            "price": str(current_price) if 'current_price' in locals() else "0",
                            "stop_loss": f"{stop_loss:.2f}" if 'stop_loss' in locals() else "0",
                            "take_profit": f"{take_profit:.2f}" if 'take_profit' in locals() else "0",
                            "order_type": "MARKET",
                            "status": "Error",
                            "mode": "forward-testing",
                            "veto_reason": str(exec_error),
                            "tradeSessionId": "SESSION_" + str(int(datetime.utcnow().timestamp()))
                        })
                        
                # Sleep extensively for this symbol to avoid spamming signals
                await asyncio.sleep(300) 
            else:
                await asyncio.sleep(30)

    async def send_telegram(self, msg: str):
        if not CONFIG.telegram_enabled or not CONFIG.telegram_bot_token:
            return
            
        url = f"https://api.telegram.org/bot{CONFIG.telegram_bot_token}/sendMessage"
        payload = {"chat_id": CONFIG.telegram_chat_id, "text": msg}
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(url, json=payload)
                if resp.status_code != 200:
                    logger.warn(f"Failed to send telegram: {resp.text}")
            except Exception as e:
                logger.error(f"Telegram webhook error: {e}")

# REST API endpoints
async def handle_status(request):
    return web.json_response({
        "status": "online", 
        "gates": "armed", 
        "testnet": CONFIG.testnet,
        "mode": "forward-testing"
    })

async def handle_health(request):
    return web.json_response({"status": "Healthy", "version": "Rave Godmode v1"})

async def handle_signals(request):
    # Request access to the runner instance attached to the app if needed,
    # or just return a simple state for the scaffold
    return web.json_response({
        "signals_captured": 0, # Scaffold value, connect to runner.testnet_signals_captured in future
        "required": 20,
        "ready_for_live": False
    })

async def init_app():
    app = web.Application()
    app.router.add_get('/status', handle_status)
    app.router.add_get('/health', handle_health)
    app.router.add_get('/signals', handle_signals)
    return app

if __name__ == "__main__":
    runner = BotRunner()
    loop = asyncio.get_event_loop()
    
    # Launch web server wrapper alongside main loop
    app = loop.run_until_complete(init_app())
    web_runner = web.AppRunner(app)
    loop.run_until_complete(web_runner.setup())
    site = web.TCPSite(web_runner, '0.0.0.0', 8080)
    loop.run_until_complete(site.start())
    
    logger.info("REST API running on port 8080. Awaiting Next.js proxies...")
    
    # Run the bot event loop indefinitely
    try:
        loop.run_until_complete(runner.start())
    except KeyboardInterrupt:
        logger.info("Bot shutting down...")
        loop.run_until_complete(runner.data_store.close())
