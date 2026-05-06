import os
import asyncio
import datetime
from typing import Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from ..schemas import BotStatus, BotJournalEntry

class BotStateManager:
    def __init__(self):
        self.status = BotStatus(
            liveTradingEnabled=False,
            mode="PAPER",
            killSwitchArmed=False,
            connected=True,
            lastSync=datetime.datetime.utcnow().isoformat() + "Z",
            currentSymbol="BTCUSDT",
            currentPrice=0.0,
            currentVolume24h=0.0,
            spread=0.0,
            riskPct=1.0
        )
        self.config = {
            "liveTradingEnabled": False,
            "riskPct": 1.0,
            "apiKeyConfigured": True
        }
        self.journal = []
        
        self.mongo_uri = os.getenv("MONGODB_URI")
        self.db_client = None
        self.db = None
        self.journal_collection = None
        
        if self.mongo_uri:
            try:
                self.db_client = AsyncIOMotorClient(self.mongo_uri, serverSelectionTimeoutMS=5000)
                self.db = self.db_client["RaveGodmodeDB"]
                self.journal_collection = self.db["journal"]
                print("[MongoDB] Async Motor Client initialized for Journal")
            except Exception as e:
                print(f"[MongoDB] Async Motor Client failed to initialize: {e}")

    async def sync_journal_from_db(self):
        if self.journal_collection is not None:
            try:
                cursor = self.journal_collection.find().sort("ts", -1).limit(100)
                entries = await cursor.to_list(length=100)
                self.journal = []
                for e in entries:
                    e.pop("_id", None)
                    # Convert to BotJournalEntry
                    try:
                        entry = BotJournalEntry(**e)
                        self.journal.append(entry)
                    except Exception as parse_ex:
                        print(f"Failed to parse saved journal entry: {parse_ex}")
            except Exception as e:
                print(f"[MongoDB] Failed to sync journal from DB: {e}")
        return self.journal

    async def add_journal_entry(self, entry: BotJournalEntry):
        self.journal.insert(0, entry)
        if len(self.journal) > 100:
            self.journal = self.journal[:100]
            
        if self.journal_collection is not None:
            try:
                await self.journal_collection.insert_one(entry.model_dump())
            except Exception as e:
                print(f"[MongoDB] Failed to save journal entry: {e}")

    def get_status(self) -> BotStatus:
        self.status.lastSync = datetime.datetime.utcnow().isoformat() + "Z"
        return self.status

    def update_kill_switch(self, armed: bool):
        self.status.killSwitchArmed = armed
        return {"armed": armed, "updatedAt": datetime.datetime.utcnow().isoformat() + "Z"}

    def update_config(self, payload: Dict[str, Any]):
        for key, value in payload.items():
            if key in self.config:
                self.config[key] = value
        self.status.liveTradingEnabled = self.config["liveTradingEnabled"]
        self.status.riskPct = self.config["riskPct"]
        return self.config

bot_state = BotStateManager()
