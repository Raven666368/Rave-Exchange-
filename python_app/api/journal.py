from fastapi import APIRouter, Depends
from typing import List
from ..services.bot_state import BotStateManager
from ..schemas import BotJournalEntry
from ..deps import get_bot_state

router = APIRouter(prefix="/api", tags=["journal"])

@router.get("/journal", response_model=List[BotJournalEntry])
async def list_journal(state: BotStateManager = Depends(get_bot_state)):
    return await state.sync_journal_from_db()

@router.post("/journal", response_model=BotJournalEntry)
async def create_journal_entry(
    entry: BotJournalEntry,
    state: BotStateManager = Depends(get_bot_state)
):
    await state.add_journal_entry(entry)
    return entry
