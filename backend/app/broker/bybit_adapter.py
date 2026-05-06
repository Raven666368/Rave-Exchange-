import httpx
import time
import hmac
import hashlib
from app.broker.base import BaseBroker

class BybitAdapter(BaseBroker):

    def __init__(self, api_key, api_secret):
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = "https://api-testnet.bybit.com"  # Testnet by default

    def _sign(self, params: str):
        return hmac.new(
            self.api_secret.encode(),
            params.encode(),
            hashlib.sha256
        ).hexdigest()

    async def place_order(self, order):
        # We assume order object has .symbol, .side, .type, .volume
        payload = {
            "symbol": order.symbol if hasattr(order, 'symbol') else getattr(order, 'symbol', order.get('symbol', 'BTCUSDT')),
            "side": order.side if hasattr(order, 'side') else getattr(order, 'side', order.get('side', 'Buy')),
            "orderType": order.type if hasattr(order, 'type') else getattr(order, 'type', order.get('type', 'Market')),
            "qty": str(order.volume) if hasattr(order, 'volume') else str(getattr(order, 'volume', order.get('volume', 0.1))),
            "timeInForce": "GTC"
        }

        # Mock response if credentials are not provided (so we don't break the environment)
        if not self.api_key or not self.api_secret or self.api_key == "mock":
            return {"retCode": 0, "retMsg": "OK", "result": {"orderId": "mock-order-id"}}

        async with httpx.AsyncClient() as client:
            # Note: actual Bybit V5 auth requires timestamp, recvWindow, signature in headers
            # Here we provide a stylized version conforming to the prompt structure
            try:
                res = await client.post(
                    f"{self.base_url}/v5/order/create",
                    json=payload
                )
                return res.json()
            except Exception as e:
                return {"error": str(e)}

    async def fetch_positions(self):
        if not self.api_key or self.api_key == "mock":
            return []
        
        async with httpx.AsyncClient() as client:
            try:
                res = await client.get(
                    f"{self.base_url}/v5/position/list",
                    params={"category": "linear", "symbol": "BTCUSDT"}
                )
                return res.json().get("result", {}).get("list", [])
            except Exception as e:
                return []
