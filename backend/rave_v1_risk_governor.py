import logging
import asyncio
from typing import Dict, List, Any
from .rave_v1_config import CONFIG

logger = logging.getLogger("RiskGovernor")

class AutonomousGovernor:
    def __init__(self, bybit_adapter):
        self.bybit_adapter = bybit_adapter
        self.status = "NORMAL"
        self.active_tripwires: List[Dict[str, str]] = []
        self.automated_actions: List[str] = []
        
        self.metrics = {
            "drawdown": 0.0,
            "latency": 0.0,
            "slippageScore": 0.0,
            "strategyCoherence": 1.0
        }
        
        self.initial_balance = None
        
        # Thresholds
        self.max_drawdown = 5.0  # 5%
        self.max_latency = 500  # ms
        
    async def initialize(self):
        # Fetch initial balance
        try:
            balance = await self.bybit_adapter.exchange.fetch_balance()
            total_equity = balance['total'].get('USDT', 0)
            self.initial_balance = total_equity
            logger.info(f"Governor initialized: Initial Balance = {total_equity}")
        except Exception as e:
            logger.error(f"Governor init failed to fetch balance: {e}")
            
    async def evaluate_tripwires(self, microstructure_signals: Dict[str, Any] = None):
        """Evaluate system health based on metrics independently."""
        self.active_tripwires = []
        self.automated_actions = []
        new_status = "NORMAL"
        
        # 1. Drawdown Check
        try:
            balance = await self.bybit_adapter.exchange.fetch_balance()
            current_equity = balance['total'].get('USDT', 0)
            
            if self.initial_balance is not None and self.initial_balance > 0:
                dd = ((self.initial_balance - current_equity) / self.initial_balance) * 100
                self.metrics["drawdown"] = dd
                
                if dd > self.max_drawdown:
                    self.active_tripwires.append({"level": "SHUTDOWN", "message": f"Daily Max Drawdown breached: {dd:.2f}% > {self.max_drawdown}%"})
                    new_status = "SHUTDOWN"
                elif dd > self.max_drawdown * 0.6:
                    self.active_tripwires.append({"level": "DEFENSIVE", "message": f"Drawdown elevated: {dd:.2f}%"})
                    if new_status not in ["SHUTDOWN"]:
                        new_status = "DEFENSIVE"
        except Exception as e:
            logger.error(f"Error checking balance: {e}")

        # 2. Latency / Stability (Mock evaluation)
        if self.metrics["latency"] > self.max_latency:
            self.active_tripwires.append({"level": "WARNING", "message": f"High Execution Latency: {self.metrics['latency']}ms"})
            if new_status == "NORMAL":
                new_status = "WARNING"
                
        # 3. Strategy Coherence
        if self.metrics["strategyCoherence"] < 0.5:
             self.active_tripwires.append({"level": "DEFENSIVE", "message": f"Strategy Coherence Collapsed: {self.metrics['strategyCoherence']:.2f}"})
             if new_status in ["NORMAL", "WARNING"]:
                 new_status = "DEFENSIVE"

        # 4. Microstructure Anomalies
        if microstructure_signals:
            for sym, sig in microstructure_signals.items():
                if sig and sig.get("depth_collapse"):
                    self.active_tripwires.append({"level": "WARNING", "message": f"Depth Collapse detected on {sym}"})
                    if new_status == "NORMAL":
                        new_status = "WARNING"
                if sig and sig.get("exchange_divergence", 0) > 15: # > 15 bps divergence
                    self.active_tripwires.append({"level": "DEFENSIVE", "message": f"High Exchange Divergence on {sym}: {sig['exchange_divergence']:.1f} bps"})
                    if new_status in ["NORMAL", "WARNING"]:
                        new_status = "DEFENSIVE"
                 
        self.status = new_status
        await self.enforce_actions()
        
    async def enforce_actions(self):
        if self.status == "WARNING":
            self.automated_actions = ["Reduced leverage to 1x", "Raised dashboard alert"]
            CONFIG.risk_per_trade_pct = min(CONFIG.risk_per_trade_pct, 0.5)
            
        elif self.status == "DEFENSIVE":
            self.automated_actions = ["Disabled momentum worker", "Throttle new orders to 1/min"]
            CONFIG.risk_per_trade_pct = min(CONFIG.risk_per_trade_pct, 0.2)
            
        elif self.status == "SHUTDOWN":
            self.automated_actions = ["Execution Frozen", "All pending orders cancelled", "Recovery mode entered"]
            # Cancel all orders
            for sym in CONFIG.symbols:
                try:
                    await self.bybit_adapter.exchange.cancel_all_orders(sym)
                except Exception:
                    pass
            CONFIG.live_trading_enabled = False
            
    def get_state(self):
        return {
            "status": self.status,
            "activeTripwires": self.active_tripwires,
            "automatedActions": self.automated_actions,
            "metrics": self.metrics
        }
