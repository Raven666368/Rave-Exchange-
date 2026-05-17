from fastapi import APIRouter, Depends
from ..services.bot_state import BotState
from ..schemas import BotKillSwitch
from ..deps import get_bot_state

router = APIRouter(prefix="/api", tags=["killswitch"])

@router.get("/killswitch", response_model=BotKillSwitch)
async def get_killswitch(state: BotState = Depends(get_bot_state)):
    status = state.get_status()
    return {"armed": status.killSwitchArmed, "updatedAt": status.lastSync or ""}

@router.post("/killswitch", response_model=BotKillSwitch)
async def set_killswitch(
    payload: BotKillSwitch,
    state: BotState = Depends(get_bot_state)
):
    return state.update_kill_switch(payload.armed)
