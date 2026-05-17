import json
import asyncio
import uuid
import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..services.bot_state import BotStateManager
from ..deps import get_bot_state

router = APIRouter(tags=["ws"])
clients: set[WebSocket] = set()

async def broadcast(message: dict):
    dead = []
    payload = json.dumps(message)
    for ws in clients:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.discard(ws)

@router.websocket("/ws/bot")
async def bot_ws(websocket: WebSocket):
    await websocket.accept()
    state = get_bot_state()
    clients.add(websocket)
    try:
        # Send initial status
        status = state.get_status()
        await websocket.send_text(json.dumps({
            "type": "status",
            "payload": status.dict()
        }))
        
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong", "payload": {}}))
    except WebSocketDisconnect:
        clients.discard(websocket)

# Background simulation task
async def signal_simulator():
    state = get_bot_state()
    while True:
        await asyncio.sleep(30)
        if state.status.connected:
            signal = {
                "id": str(uuid.uuid4()),
                "ts": datetime.datetime.utcnow().isoformat() + "Z",
                "symbol": "BTCUSDT",
                "side": "REVERSION_LONG",
                "confidence": 0.85,
                "reason": "ICT Sweep + MSS confirmed on 5m",
                "price": 65000.0
            }
            await broadcast({
                "type": "signal",
                "payload": signal
            })
