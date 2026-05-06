export type TradeSide = "Buy" | "Sell";
export type OrderType = "Market" | "Limit";

export interface BybitOrderRequest {
  category: "linear";
  symbol: string;
  side: TradeSide;
  orderType: OrderType;
  qty: string;
  price?: string;
  timeInForce: "GTC" | "IOC" | "FOK" | "PostOnly";
  positionIdx?: 0 | 1 | 2;
  reduceOnly?: boolean;
  orderLinkId: string;
  takeProfit?: string;
  stopLoss?: string;
  tpOrderType?: "Market" | "Limit";
  slOrderType?: "Market" | "Limit";
  tpLimitPrice?: string;
  slLimitPrice?: string;
  tpslMode?: "Full" | "Partial";
}

export interface BybitOrderResult {
  retCode: number;
  retMsg: string;
  result?: {
    orderId?: string;
    orderLinkId?: string;
  };
  retExtInfo?: unknown;
  time?: number;
}

function buildOrderPayload(req: BybitOrderRequest) {
  const payload: Record<string, string | number | boolean | undefined> = {
    category: req.category,
    symbol: req.symbol,
    side: req.side,
    orderType: req.orderType,
    qty: req.qty,
    price: req.price,
    timeInForce: req.timeInForce,
    positionIdx: req.positionIdx,
    reduceOnly: req.reduceOnly,
    orderLinkId: req.orderLinkId,
    takeProfit: req.takeProfit,
    stopLoss: req.stopLoss,
    tpOrderType: req.tpOrderType,
    slOrderType: req.slOrderType,
    tpLimitPrice: req.tpLimitPrice,
    slLimitPrice: req.slLimitPrice,
    tpslMode: req.tpslMode,
  };
  return payload;
}

export async function placeBybitTestnetOrder(
  apiKey: string,
  apiSecret: string,
  request: BybitOrderRequest,
): Promise<BybitOrderResult> {
  if (!apiKey || !apiSecret) throw new Error("Missing Bybit API credentials");

  const timestamp = Date.now().toString();
  const recvWindow = "5000";
  const body = JSON.stringify(buildOrderPayload(request));

  const signString = `${timestamp}${apiKey}${recvWindow}${body}`;
  const signature = await hmacSha256Hex(apiSecret, signString);

  const res = await fetch("https://api-testnet.bybit.com/v5/order/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-SIGN": signature,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": recvWindow,
    },
    body,
  });

  const json = (await res.json()) as BybitOrderResult;

  if (!res.ok || json.retCode !== 0) {
    throw new Error(`Bybit order failed: ${json.retCode} ${json.retMsg}`);
  }

  return json;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
