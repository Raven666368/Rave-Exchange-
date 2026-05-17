import * as crypto from "crypto";
import WebSocket from "ws";
import { telegramBot } from "./telegram-bot.js";

const BYBIT_TESTNET = process.env["BYBIT_TESTNET"] !== "false"; // Defaults to true unless explicitly false
const BYBIT_URL = BYBIT_TESTNET ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
const BYBIT_WS_URL = BYBIT_TESTNET ? "wss://stream-testnet.bybit.com/v5/private" : "wss://stream.bybit.com/v5/private";
let BYBIT_API_KEY = process.env["BYBIT_API_KEY"] || "YOUR_KEY";
let BYBIT_API_SECRET = process.env["BYBIT_API_SECRET"] || "YOUR_SECRET";
let USER_TIMEZONE = "UTC";

export function setBybitCredentials(apiKey: string, apiSecret: string, timezone?: string) {
  BYBIT_API_KEY = apiKey;
  BYBIT_API_SECRET = apiSecret;
  if (timezone) {
    USER_TIMEZONE = timezone;
  }
  console.log(`[Credentials] API Keys updated. Local Timezone set to: ${USER_TIMEZONE}`);
  if (bybitPrivateWs) {
    bybitPrivateWs.removeAllListeners("close");
    bybitPrivateWs.close();
    bybitPrivateWs = null;
  }
  initBybitWebsocket();
}
const LIVE_TRADING = process.env["LIVE_TRADING"] === "true";

function getSignature(params: string, timestamp: number, recvWindow: number): string {
  const signString = timestamp.toString() + BYBIT_API_KEY + recvWindow.toString() + params;
  return crypto.createHmac("sha256", BYBIT_API_SECRET).update(signString).digest("hex");
}

async function request(method: string, endpoint: string, data?: Record<string, unknown>) {
  const timestamp = Date.now();
  const recvWindow = 5000;
  
  let paramsString = "";
  if (method === "GET" && data) {
    const searchParams = new URLSearchParams(data as Record<string, string>);
    paramsString = searchParams.toString();
  } else if (method === "POST" && data) {
    paramsString = JSON.stringify(data);
  }

  const signature = getSignature(paramsString, timestamp, recvWindow);
  
  const headers: Record<string, string> = {
    "X-BAPI-API-KEY": BYBIT_API_KEY,
    "X-BAPI-TIMESTAMP": timestamp.toString(),
    "X-BAPI-RECV-WINDOW": recvWindow.toString(),
    "X-BAPI-SIGN": signature,
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  let url = `${BYBIT_URL}${endpoint}`;
  if (method === "GET" && paramsString) {
    url += `?${paramsString}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? paramsString : undefined,
  });

  const responseText = await response.text();
  if (!responseText) {
    throw new Error(`Empty response from Bybit API (Status: ${response.status}). Check backend logs. If status is 401, check API keys.`);
  }

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error(`Error parsing Bybit Response for ${method} ${url}: status=${response.status} text='${responseText}'`, err);
    throw new Error(`Invalid response: ${responseText}`);
  }
}

export async function fetchWalletBalance() {
  if (!LIVE_TRADING) {
    return {
      retCode: 0,
      retMsg: "OK",
      result: {
        list: [
          {
            coin: [
              { coin: "USDT", walletBalance: "50000.00" }
            ]
          }
        ]
      }
    };
  }
  return request("GET", "/v5/account/wallet-balance", { accountType: "UNIFIED" });
}

export interface TpLevel {
  price: number;
  percent: number;
}

export async function placeLimitOrder(
  symbol: string, 
  side: "Buy" | "Sell", 
  qty: string, 
  price: string, 
  stopLoss?: string, 
  takeProfit?: string
) {
  const orderPayload: Record<string, unknown> = {
    category: "linear",
    symbol,
    side,
    orderType: "Limit",
    qty: qty,
    price: price,
    timeInForce: "GTC"
  };

  if (stopLoss) orderPayload["stopLoss"] = stopLoss;
  if (takeProfit) orderPayload["takeProfit"] = takeProfit;

  if (!LIVE_TRADING) {
    console.log("PAPER MODE - BYBIT API ORDER CREATE PAYLOAD SIMULATED:");
    console.log(JSON.stringify(orderPayload, null, 2));
    
    // Simulate real execution data
    return {
      retCode: 0,
      retMsg: "OK",
      result: {
        orderId: `simulated-order-${Date.now()}`,
        orderLinkId: ""
      },
      extInfo: { simulated: true, payload: orderPayload }
    };
  }

  return request("POST", "/v5/order/create", orderPayload);
}

export async function placeReduceOnlyLimitOrder(
  symbol: string, 
  side: "Buy" | "Sell", 
  qty: string, 
  price: string
) {
  const orderPayload: Record<string, unknown> = {
    category: "linear",
    symbol,
    side,
    orderType: "Limit",
    qty: qty,
    price: price,
    timeInForce: "GTC",
    reduceOnly: true
  };

  if (!LIVE_TRADING) {
    console.log("PAPER MODE - REDUCE ONLY ORDER SIMULATED:");
    return {
      retCode: 0,
      retMsg: "OK",
      result: {
        orderId: `simulated-tp-${Date.now()}-${price}`
      },
      extInfo: { simulated: true, payload: orderPayload }
    };
  }
  return request("POST", "/v5/order/create", orderPayload);
}

export async function cancelOrder(symbol: string, orderId: string) {
  const payload = { category: "linear", symbol, orderId };
  if (!LIVE_TRADING) {
    return { retCode: 0, retMsg: "OK", result: { orderId } };
  }
  return request("POST", "/v5/order/cancel", payload);
}

export async function fetchRealtimeOrder(orderId: string) {
  return request("GET", "/v5/order/realtime", { category: "linear", orderId });
}

// Global active WebSocket for private streams
let bybitPrivateWs: WebSocket | null = null;
type OrderUpdateCallback = (data: unknown) => void;
const orderCallbacks: OrderUpdateCallback[] = [];

// Track auth status
export let privateAuthStatus: { working: boolean, error: string | null } = { working: false, error: null };

export function subscribeToOrderUpdates(callback: OrderUpdateCallback) {
  orderCallbacks.push(callback);
}

export function initBybitWebsocket() {
  if (bybitPrivateWs) return bybitPrivateWs;

  let shouldReconnect = true;
  bybitPrivateWs = new WebSocket(BYBIT_WS_URL);

  bybitPrivateWs.on("open", () => {
    console.log("Connected to Bybit Private WS");
    
    if (BYBIT_API_KEY === "YOUR_KEY" || !BYBIT_API_KEY || BYBIT_API_KEY.includes("placeholder") || BYBIT_API_KEY.includes("insert")) {
      console.warn("Bybit API key is not configured or dummy. Bypassing private WS auth.");
      privateAuthStatus = { working: false, error: "API Credentials Missing or Dummy" };
      return;
    }

    const expires = Date.now() + 10000;
    const signature = crypto.createHmac("sha256", BYBIT_API_SECRET)
      .update(`GET/realtime${expires}`)
      .digest("hex");

    const authMessage = {
      op: "auth",
      args: [BYBIT_API_KEY, expires, signature]
    };

    bybitPrivateWs?.send(JSON.stringify(authMessage));
  });

  bybitPrivateWs.on("message", (data: { toString: () => string }) => {
    try {
      const parsed = JSON.parse(data.toString());
      if (parsed.op === "auth") {
        console.log("Bybit WS Auth Status:", parsed);
        if (parsed.success) {
          privateAuthStatus = { working: true, error: null };
          const subscribeMsg = {
            op: "subscribe",
            args: ["order"] // Subscribe to order stream
          };
          bybitPrivateWs?.send(JSON.stringify(subscribeMsg));
        } else {
          privateAuthStatus = { working: false, error: parsed.ret_msg || "Auth Failed" };
          console.error("Bybit Private WS Auth Failed (Fallback to read-only Mode):", parsed.ret_msg);
          telegramBot.broadcast(`❌ <b>CONNECTION ERROR</b> ❌\nBybit Auth Failed: ${parsed.ret_msg}\nFalling back to read-only mode.`);
          shouldReconnect = false;
          if (bybitPrivateWs) {
             bybitPrivateWs.close();
             bybitPrivateWs = null;
          }
        }
      } else if (parsed.topic === "order") {
        // Broadcast to callbacks
        orderCallbacks.forEach(cb => cb(parsed.data));
      }
    } catch (error) {
      console.error("Error parsing Bybit WS message:", error);
    }
  });
  
  bybitPrivateWs.on("error", (error) => {
    console.error("Bybit WS Error:", error);
  });
  
  bybitPrivateWs.on("close", () => {
    if (!shouldReconnect) return;
    console.log("Bybit WS Closed, reconnecting in 5s...");
    telegramBot.broadcast(`⚠️ <b>CONNECTION LOST</b> ⚠️\nBybit Private WS closed unexpectedly. Reconnecting in 5s...`);
    bybitPrivateWs = null;
    setTimeout(initBybitWebsocket, 5000);
  });

  return bybitPrivateWs;
}

// Fetch Market Info (for Spread Validation)
export async function fetchMarketSpread(symbol: string) {
   const response = await fetch(`${BYBIT_URL}/v5/market/tickers?category=linear&symbol=${symbol}`);
   if (!response.ok) throw new Error("Failed to fetch target ticker");
   const data = await response.json();
   if (data.retCode !== 0 || data.result.list.length === 0) throw new Error("Ticker result empty");
   const ticker = data.result.list[0];
   const ask1Price = parseFloat(ticker.ask1Price);
   const bid1Price = parseFloat(ticker.bid1Price);
   const spreadAbs = ask1Price - bid1Price;
   const spreadPct = (spreadAbs / bid1Price) * 100;
   
   return { ask1Price, bid1Price, spreadAbs, spreadPct };
}
