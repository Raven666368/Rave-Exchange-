from fastapi import APIRouter, Depends, Body
from ..services.bot_state import BotState
from ..schemas import BotConfig
from ..deps import get_bot_state

router = APIRouter(prefix="/api", tags=["config"])

@router.get("/config", response_model=BotConfig)
async def get_config(state: BotState = Depends(get_bot_state)):
    return BotConfig(**state.config)

@router.put("/config", response_model=BotConfig)
async def update_config(payload: dict = Body(...), state: BotState = Depends(get_bot_state)):
    updated = state.update_config(payload)
    return BotConfig(**updated)
