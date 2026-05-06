from fastapi import APIRouter, Depends
from ..services.bot_state import BotState
from ..schemas import BotStatus
from ..deps import get_bot_state

router = APIRouter(prefix="/api", tags=["status"])

@router.get("/status", response_model=BotStatus)
async def get_status(state: BotState = Depends(get_bot_state)):
    return state.get_status()
