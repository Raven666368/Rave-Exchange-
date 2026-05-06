import asyncio
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager

from app.engine.execution_engine import ExecutionEngine
from app.models.order import Order
from app.services.market_data import BybitMarketDataStream
from app.websocket.manager import manager
from app.websocket.consumers import start_consumers

from app.strategy.workers.momentum import MomentumWorker
from app.strategy.workers.mean_reversion import MeanReversionWorker
from app.strategy.worker_cluster import StrategyWorkerCluster
from app.strategy.consumer import strategy_consumer
from app.events.bus import bus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine = ExecutionEngine()
market_stream = BybitMarketDataStream(use_testnet=True)

momentum_worker = MomentumWorker("momentum_7")
reversion_worker = MeanReversionWorker("mean_rev_3")
worker_cluster = StrategyWorkerCluster([momentum_worker, reversion_worker], bus)

# Callback to broadcast market data to connected clients
async def broadcast_market_data(data_type: str, symbol: str, data: dict):
    payload = {
        "event": data_type,
        "symbol": symbol,
        "data": data
    }
    await manager.broadcast_json(payload)
    
    # Send specific ticks to strategies
    if data_type == "ticker":
        tick_data = {"symbol": symbol, "price": str(data.get("last", 0))}
        await bus.publish("market_ticks", tick_data)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start market streams
    logger.info("Starting Bybit Market Data Streams...")
    market_stream.subscribe(broadcast_market_data)
    
    # Run streams in the background
    symbols = ["BTC/USDT:USDT", "ETH/USDT:USDT"]
    stream_tasks = await market_stream.start_streams(symbols)
    
    logger.info("Starting Redis Consumers & PnL Engine loop...")
    consumer_tasks = await start_consumers()
    pnl_task = asyncio.create_task(engine.pnl_stream_loop())
    strategy_task = asyncio.create_task(strategy_consumer(worker_cluster, bus))
    
    yield
    
    # Shutdown
    logger.info("Closing Bybit Market Data Streams and Consumers...")
    for t in stream_tasks + consumer_tasks + [pnl_task, strategy_task]:
        t.cancel()
    await market_stream.close()

app = FastAPI(lifespan=lifespan)

@app.get("/")
def health():
    return {"status": "Rave Engine Running with Live Market Data Streams"}

@app.post("/order")
async def place_order(order: Order):
    price = 1.1000  # Placeholder, should fetch from market_stream.ticks
    result = await engine.place_order(order, price)
    return result

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection open and listen for client messages if any
            data = await websocket.receive_text()
            # Can handle incoming client commands (e.g. subscribe to specific pairs)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


