from functools import lru_cache
from .services.bot_state import BotStateManager

@lru_cache
def get_bot_state() -> BotStateManager:
    return BotStateManager()
