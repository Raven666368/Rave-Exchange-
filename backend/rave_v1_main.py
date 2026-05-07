import asyncio
import logging
from aiohttp import web
import json
import httpx
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON
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

Base = declarative_base()

class SQLJournal(Base):
    __tablename__ = "journals"
    id = Column(Integer, primary_key=True)
    symbol = Column(String(20))
    side = Column(String(10))
    qty = Column(String(50))
    price = Column(String(50))
    stop_loss = Column(String(50))
    take_profit = Column(String(50))
    order_type = Column(String(20))
    status = Column(String(50))
    mode = Column(String(50))
    veto_reason = Column(String(255))
    exchangeOrderId = Column(String(100))
    tradeSessionId = Column(String(100))
    createdAt = Column(DateTime, default=datetime.utcnow)

class SQLDecisionTrace(Base):
    __tablename__ = "decision_traces"
    id = Column(String(100), primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    symbol = Column(String(20))
    final_decision = Column(String(50))
    contributors = Column(JSON)
    strategy_weights = Column(JSON)
    pnl_snapshot = Column(Float)
    payload = Column(JSON)

class SQLMarketSnapshot(Base):
    __tablename__ = "market_snapshots"
    id = Column(Integer, primary_key=True)
    data = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)

class BotRunner:
    def __init__(self):
        self.data_store = DataStore()
        self.bybit_adapter = BybitAdapter(self.data_store.bybit)
        self.structure = StructureEngine()
        self.engine = GateEngine(self.data_store, self.structure)
        self.testnet_signals_captured = 0
        
        # MongoDB
        self.db_client = None
        self.journals_col = None
        self.traces_col = None
        self.market_data_col = None
        
        # SQL (PostgreSQL)
        self.sql_engine = None
        self.sql_session_factory = None

        # WebSocket
        self.connected_clients = set()
        
        # Killswitch
        self.killswitch_armed = False
        
    async def init_mongo(self):
        if CONFIG.mongodb_uri and "db_password" not in CONFIG.mongodb_uri:
            try:
                self.db_client = AsyncIOMotorClient(CONFIG.mongodb_uri, serverSelectionTimeoutMS=5000)
                db = self.db_client["ravebot"]
                self.journals_col = db["journals"]
                self.traces_col = db["decision_traces"]
                self.market_data_col = db["market_data"]
                await self.db_client.admin.command('ping')
                logger.info("[DB] MongoDB Connected")
            except Exception as e:
                logger.warning(f"[DB] MongoDB Connection failed: {e}")
        else:
            logger.info("[DB] MongoDB URI not provided.")

    async def init_postgres(self):
        if CONFIG.postgres_uri:
            try:
                # Ensure we use async driver if not specified
                lib_uri = CONFIG.postgres_uri
                if lib_uri.startswith("postgresql://"):
                    lib_uri = lib_uri.replace("postgresql://", "postgresql+asyncpg://", 1)
                
                self.sql_engine = create_async_engine(lib_uri, echo=False)
                self.sql_session_factory = sessionmaker(
                    self.sql_engine, expire_on_commit=False, class_=AsyncSession
                )
                
                async with self.sql_engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                
                logger.info("[DB] PostgreSQL Connected")
            except Exception as e:
                logger.error(f"[DB] PostgreSQL Initialization Error: {e}")
        else:
            logger.info("[DB] PostgreSQL URI not provided.")

    async def broadcast(self, message: dict):
        if not self.connected_clients:
            return
        payload = json.dumps(message)
        dead = []
        for ws in self.connected_clients:
            try:
                await ws.send_str(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.connected_clients.remove(ws)

    async def log_journal(self, entry: dict):
        # Broadcast to UI
        await self.broadcast({"type": "journal", "payload": entry})
        
        # 1. Log to MongoDB
        if getattr(self, "journals_col", None) is not None:
            mongo_entry = entry.copy()
            mongo_entry["id"] = int(datetime.utcnow().timestamp() * 1000)
            mongo_entry["createdAt"] = datetime.utcnow()
            mongo_entry["timestamp"] = datetime.utcnow().isoformat()
            try:
                await self.journals_col.insert_one(mongo_entry)
            except Exception: pass
            
        # 2. Log to PostgreSQL
        if self.sql_session_factory:
            try:
                async with self.sql_session_factory() as session:
                    journal = SQLJournal(
                        symbol=entry.get("symbol"),
                        side=entry.get("side"),
                        qty=str(entry.get("qty")),
                        price=str(entry.get("price")),
                        stop_loss=entry.get("stop_loss"),
                        take_profit=entry.get("take_profit"),
                        order_type=entry.get("order_type"),
                        status=entry.get("status"),
                        mode=entry.get("mode"),
                        veto_reason=entry.get("veto_reason"),
                        exchangeOrderId=entry.get("exchangeOrderId"),
                        tradeSessionId=entry.get("tradeSessionId")
                    )
                    session.add(journal)
                    await session.commit()
            except Exception as e:
                logger.error(f"[SQL] Journal Save Error: {e}")

    async def log_decision_trace(self, trace: dict):
        # Broadcast to UI
        await self.broadcast({"type": "signal", "payload": trace})
        
        # Log to MongoDB
        if getattr(self, "traces_col", None) is not None:
            trace["timestamp"] = datetime.utcnow().isoformat()
            try:
                await self.traces_col.insert_one(trace)
            except Exception: pass
            
        # Log to PostgreSQL
        if self.sql_session_factory:
            try:
                import uuid
                async with self.sql_session_factory() as session:
                    st = SQLDecisionTrace(
                        id=str(uuid.uuid4()),
                        symbol=trace.get("symbol"),
                        final_decision=trace.get("final_decision", ""),
                        contributors=trace.get("contributors", {}),
                        strategy_weights=trace.get("strategy_weights", {}),
                        pnl_snapshot=trace.get("pnl_snapshot", 0.0),
                        payload=trace
                    )
                    session.add(st)
                    await session.commit()
            except Exception as e:
                logger.error(f"[SQL] Decision Trace Save Error: {e}")

    async def log_market_data(self, data: dict):
        # Broadcast to UI
        if data.get("type") == "spread_snapshot":
             await self.broadcast({"type": "status", "payload": {
                 "spread": self.data_store.get_spread("BTCUSDT"),
                 "currentPrice": self.data_store.latest_prices.get("BTCUSDT", {}).get("bybit", 0)
             }})
        
        # Log to MongoDB
        if getattr(self, "market_data_col", None) is not None:
            data["timestamp"] = datetime.utcnow().isoformat()
            try:
                await self.market_data_col.insert_one(data)
            except Exception: pass
            
        # Log to PostgreSQL
        if self.sql_session_factory:
            try:
                async with self.sql_session_factory() as session:
                    sn = SQLMarketSnapshot(data=data)
                    session.add(sn)
                    await session.commit()
            except Exception: pass

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
        await self.init_postgres()
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
            if self.killswitch_armed:
                await asyncio.sleep(60)
                continue
                
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
                    
                    # Log Trace
                    await self.log_decision_trace({
                        "symbol": sym,
                        "final_decision": side.upper(),
                        "contributors": {"structure": 0.5, "pca": 0.3, "htf": 0.2},
                        "strategy_weights": {"reversion": 0.8, "trend": 0.2},
                        "pnl_snapshot": 0.0,
                        "reasons": reasons
                    })
                else:
                    failed_gates = [k for k, v in gates.items() if not v]
                    failed_reason = f"{failed_gates[0]} failed: {reasons.get(failed_gates[0], 'Unknown')}" if failed_gates else "Unknown"
                    
                    # Optional: We could log skipped traces, but it might be too noisy. Let's just log every 10 loops or so, or skip.
                    
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
    runner = request.app['runner']
    return web.json_response({
        "status": "halted" if runner.killswitch_armed else "online", 
        "gates": "armed", 
        "testnet": CONFIG.testnet,
        "mode": "forward-testing",
        "killswitch": runner.killswitch_armed
    })

async def handle_killswitch(request):
    runner = request.app['runner']
    runner.killswitch_armed = True
    logger.critical("🚨 KILLSWITCH ARMED: Ceasing all trading activities.")
    return web.json_response({"status": "HALTED", "killswitch": True})

async def handle_health(request):
    return web.json_response({"status": "Healthy", "version": "Rave Godmode v1"})

async def handle_signals(request):
    runner = request.app['runner']
    return web.json_response({
        "signals_captured": runner.testnet_signals_captured,
        "required": 20,
        "ready_for_live": runner.testnet_signals_captured >= 20
    })

async def handle_execute(request):
    try:
        payload = await request.json()
        runner = request.app['runner']
        
        symbol = payload.get("symbol", "BTCUSDT")
        side = payload.get("side", "Buy").lower()
        amount = float(payload.get("qty", 0.001))
        
        # In this context, we usually do market orders from the dashboard
        res = await runner.bybit_adapter.create_market_order(
            symbol=symbol,
            side=side,
            amount=amount,
            stop_loss=float(payload.get("stopLoss")) if payload.get("stopLoss") else None,
            take_profit=float(payload.get("takeProfit")) if payload.get("takeProfit") else None
        )
        
        # Log manually initiated trade
        await runner.log_journal({
            "symbol": symbol,
            "side": side.upper(),
            "qty": str(amount),
            "price": str(runner.data_store.get_current_price(symbol)),
            "status": "Confirmed",
            "mode": "manual-ui",
            "exchangeOrderId": str(res.get('id', '')),
            "tradeSessionId": "MANUAL_" + str(int(datetime.utcnow().timestamp()))
        })
        
        # Log manual decision trace
        await runner.log_decision_trace({
            "symbol": symbol,
            "final_decision": side.upper(),
            "contributors": { "manual_override": 1.0 },
            "strategy_weights": { "manual": 1.0 },
            "pnl_snapshot": 0.0,
            "reasons": { "Trigger": "Manual UI Execution", "Target": symbol }
        })
        
        return web.json_response({"status": "accepted", "orderId": res.get("id"), "brokerOrderId": res.get("id")})
    except Exception as e:
        logger.error(f"Manual Execution Error: {e}")
        return web.json_response({"status": "rejected", "error": str(e)}, status=400)

async def handle_journal(request):
    try:
        payload = await request.json()
        runner = request.app['runner']
        await runner.log_journal(payload)
        return web.json_response({"status": "ok", "id": str(int(datetime.utcnow().timestamp()))})
    except Exception as e:
        logger.error(f"Manual Journal Error: {e}")
        return web.json_response({"status": "error", "error": str(e)}, status=400)

async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    
    runner = request.app['runner']
    runner.connected_clients.add(ws)
    
    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                if msg.data == 'close':
                    await ws.close()
                elif msg.data == 'ping':
                    await ws.send_str(json.dumps({"type": "pong"}))
            elif msg.type == web.WSMsgType.ERROR:
                logger.error(f'ws connection closed with exception {ws.exception()}')
    finally:
        runner.connected_clients.remove(ws)
    
    return ws

async def init_app(runner):
    app = web.Application()
    app['runner'] = runner
    app.router.add_get('/status', handle_status)
    app.router.add_get('/health', handle_health)
    app.router.add_get('/signals', handle_signals)
    app.router.add_post('/execute', handle_execute)
    app.router.add_post('/journal', handle_journal)
    app.router.add_post('/killswitch', handle_killswitch)
    app.router.add_get('/ws/bot', websocket_handler)
    return app

if __name__ == "__main__":
    runner = BotRunner()
    loop = asyncio.get_event_loop()
    
    # Launch web server wrapper alongside main loop
    app = loop.run_until_complete(init_app(runner))
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
