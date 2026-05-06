import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.status import router as status_router
from .api.killswitch import router as killswitch_router
from .api.config import router as config_router
from .api.journal import router as journal_router
from .api.trade import router as trade_router
from .ws.bot_stream import router as ws_router, signal_simulator
from .api.webhook import router as webhook_router

app = FastAPI(title="GODMODE v1 Bot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(status_router)
app.include_router(killswitch_router)
app.include_router(config_router)
app.include_router(journal_router)
app.include_router(trade_router)
app.include_router(webhook_router)
app.include_router(ws_router)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(signal_simulator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
