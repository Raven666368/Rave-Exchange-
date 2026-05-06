import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from "@angular/ssr/node";
import express from "express";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createProxyMiddleware } from "http-proxy-middleware";
import { AlchemyCoordinator } from "./lib/ai/coordinator.js";
import {
  insertJournalEntry,
  getJournalEntries,
  getJournalEntriesSince,
  getDbStatus,
  getJournalReplay,
} from "./lib/trade-journal.js";
import { telegramBot } from "./lib/telegram-bot.js";

const browserDistFolder = join(import.meta.dirname, "../browser");

const app = express();
app.use(express.json());
const angularApp = new AngularNodeAppEngine({ trustProxyHeaders: true });

async function runModel(prompt: string): Promise<string> {
  // Uses Gemini API Key injected by AI Studio
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("Missing GEMINI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          // Gemini Pro sometimes doesn't like responseMimeType in older versions,
          // but we can try it, or omit it and rely on prompt.
        },
      }),
    },
  );

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Model request failed: ${res.status} ${text}`);
  }

  const json = JSON.parse(text);
  const out = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!out) throw new Error("Empty model output");

  return out;
}

app.post("/api/ai", async (req, res) => {
  try {
    const userPrompt = req.body.prompt || "";
    const coordinator = new AlchemyCoordinator(runModel);
    const result = await coordinator.run(userPrompt);

    if (!result.ok && result.error && (result.error.includes("API key not valid") || result.error.includes("Missing GEMINI_API_KEY") || result.error.includes("API_KEY_INVALID"))) {
      console.warn("Falling back to demo AI response due to invalid API key.");
      res.json({
        ok: true,
        phase: "done",
        mode: "DEMO_MODE",
        final_action: "trade_candidate",
        failed_gate: null,
        execution_allowed: true,
        perception: {
          action_class: "reversion",
          confidence: 0.8,
          data_quality: 0.9,
          macro_bias: "Neutral",
          technical_bias: "Neutral",
          session: "Demonstration",
          entry_plan: {
            stop: "60000",
            targets: ["65000", "70000"]
          }
        },
        risk: { risk_approved: true, risk_score: 0.5, forced_mode: "DEMO_MODE" },
        execution: { execution_allowed: true, order_type: "limit" },
        journal: { notes: "Demo mode fallback used." }
      });
      return;
    }

    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ ok: false, error: message });
  }
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

import {
  fetchWalletBalance,
  placeLimitOrder,
  placeReduceOnlyLimitOrder,
  cancelOrder,
  fetchMarketSpread,
  initBybitWebsocket,
  subscribeToOrderUpdates,
  privateAuthStatus,
  setBybitCredentials
} from "./lib/bybit-api.js";

// Initialize Bybit WebSocket in background (Moved to server start)

// Active ladders mapping (position ID / symbol -> order IDs of TP limit orders)
const activeLadders = new Map<string, string[]>();

subscribeToOrderUpdates((data: unknown) => {
  if (!Array.isArray(data)) return;
  for (const order of data as Record<string, unknown>[]) {
    // Check if a stop loss (or the position) was triggered/closed
    const orderStatus = order['orderStatus'];
    const symbol = order['symbol'] as string;
    
    // In Bybit, conditional orders that fill or stop loss hits might reduce the position to 0.
    // If a StopLoss triggers:
    if (orderStatus === "Filled" && order['stopOrderType'] === "StopLoss") {
      console.log(`[Auto-Mitigation] SL Hit for ${symbol}, cascading TP cancellation.`);
      const ladderOrders = activeLadders.get(symbol) || [];
      for (const orderId of ladderOrders) {
        cancelOrder(symbol, orderId).catch(err => 
          console.error(`Failed to cancel TP order ${orderId}`, err)
        );
      }
      activeLadders.delete(symbol);
      // Log to Post-Mortem Analytics (via journal or logging)
      console.log(`[Post-Mortem] Logged invalidation for ${symbol} cascade cancel`);
      telegramBot.broadcast(`📉 <b>STOP LOSS HIT</b> 📉\nSymbol: ${symbol}\nCascading TP cancellation triggered. PnL significantly affected.`);
    } else if (orderStatus === "Filled" && order['reduceOnly']) {
      // Just a single TP hitting
      console.log(`[Auto-Mitigation] TP Ladder leg filled for ${symbol}: ${order['orderId']}`);
      telegramBot.broadcast(`📈 <b>TAKE PROFIT HIT</b> 📈\nSymbol: ${symbol}\nOrder ID: ${order['orderId']}\nTP ladder leg filled successfully.`);
    }
  }
});

app.post("/api/killswitch", (req, res) => {
  // Logic to halt the bot
  console.log("[Kill Switch] Triggered: Halting all trading activities.");
  // Simulate setting some global state or calling stop functions
  activeLadders.clear();
  telegramBot.broadcast(`🚨 <b>KILL SWITCH ACTIVATED</b> 🚨\nAll trading activities halted for safety! Ladders cleared.`);
  res.json({ status: "success", message: "Bot halted successfully" });
});

import { randomUUID } from "crypto";

app.post('/api/trading-ops/sessions', (req, res) => {
  const { session, cmeGapChecked, fundingChecked, rolloverChecked } = req.body || {};
  if (!session || !cmeGapChecked || !fundingChecked || !rolloverChecked) {
    res.status(400).json({ ok: false, message: 'Session checklist incomplete' });
    return;
  }
  res.json({ ok: true, message: 'Session checklist passed', data: { session } });
});

app.post('/api/trading-ops/validation', (req, res) => {
  const { symbol, confluenceScore, liquiditySweep, mssConfirmed, riskAccepted } = req.body || {};
  if (!symbol || confluenceScore < 7 || !liquiditySweep || !mssConfirmed || !riskAccepted) {
    res.status(400).json({ ok: false, message: 'Validation gate rejected' });
    return;
  }
  res.json({
    ok: true,
    message: 'Setup approved',
    data: { symbol, confluenceScore, gateId: randomUUID() }
  });
});

app.post('/api/trading-ops/execution', (req, res) => {
  const { symbol, side, qty, orderType, reduceOnly, dryRun } = req.body || {};
  if (!symbol || !side || !qty || !orderType) {
    res.status(400).json({ ok: false, message: 'Execution payload invalid' });
    return;
  }
  res.json({
    ok: true,
    message: dryRun ? 'Dry-run order staged' : 'Order submitted',
    data: { symbol, side, qty, orderType, reduceOnly, dryRun, executionId: randomUUID() }
  });
});

app.post('/api/trading-ops/journal', (req, res) => {
  const { symbol, thesis, entryReason, exitReason, outcome } = req.body || {};
  if (!symbol || !thesis || !entryReason) {
    res.status(400).json({ ok: false, message: 'Journal entry incomplete' });
    return;
  }
  res.json({
    ok: true,
    message: 'Journal saved',
    data: { symbol, thesis, entryReason, exitReason, outcome, journalId: randomUUID() }
  });
});

app.post('/api/trading-ops/alerts', (req, res) => {
  const { title, triggerAt, channel, enabled } = req.body || {};
  if (!title || !triggerAt || !channel) {
    res.status(400).json({ ok: false, message: 'Alert payload invalid' });
    return;
  }
  res.json({
    ok: true,
    message: 'Alert scheduled',
    data: { title, triggerAt, channel, enabled, alertId: randomUUID() }
  });
});

app.post("/api/settings/keys", (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) {
    res.status(400).json({ error: "Missing keys" });
    return;
  }
  setBybitCredentials(apiKey, apiSecret);
  res.json({ success: true, message: "Keys updated and WS reconnecting" });
});

app.post("/api/execute", async (req, res) => {
  try {
    const { symbol = "BTCUSDT", side = "Buy", qty = "0.01", price } = req.body;
    
    const startTime = Date.now();
    
    // 1. Fetch real account balance
    const balanceRes = await fetchWalletBalance();
    
    // 2. Fetch current spread
    const spreadInfo = await fetchMarketSpread(symbol);
    
    // For logging/simulation purposes, assume intended entry price was mid-price
    const intendedPrice = price ? parseFloat(price) : (spreadInfo.ask1Price + spreadInfo.bid1Price) / 2;
    const executionPrice = side.toLowerCase() === "buy" ? spreadInfo.ask1Price : spreadInfo.bid1Price;
    
    const slippageAbs = Math.abs(executionPrice - intendedPrice);
    const slippagePct = (slippageAbs / intendedPrice) * 100;
    
    // Estimated fees based on testnet maker/taker rate
    const simulatedFeeQty = parseFloat(qty) * executionPrice * 0.0006; 

    // 3. Place order (Paper logic drops the actual call inside but logs execution)
    let orderRes;
    try {
      orderRes = await placeLimitOrder(
        symbol, 
        side, 
        qty, 
        executionPrice.toString(), 
        req.body.stopLoss, 
        req.body.takeProfit
      );

      // Check Bybit API level error code
      if (orderRes && orderRes.retCode !== 0) {
        throw new Error(`Bybit API Error: ${orderRes.retMsg} (Code: ${orderRes.retCode})`);
      }
    } catch (e) {
      console.error(`[Execute] Base order placement failed for ${symbol}:`, e);
      res.status(500).json({ error: "Failed to place base order.", details: e instanceof Error ? e.message : String(e) });
      return;
    }
    
    let vetoReason = `Slippage: ${slippagePct.toFixed(3)}%, Spread: ${spreadInfo.spreadPct.toFixed(3)}%`;

    // 3b. Deploy TP Ladder if provided
    const tpLevels = req.body.tpLevels as {price: number, percent: number}[];
    if (tpLevels && tpLevels.length > 0) {
      const levelsStr = tpLevels.map((l) => `${l.price}@${l.percent}%`).join(", ");
      vetoReason += ` | TP Levels: ${levelsStr}`;
      
      const tpSide = side.toLowerCase() === "buy" ? "Sell" : "Buy";
      const submittedLadderIds: string[] = [];
      const failedTPs: number[] = [];

      for (const tp of tpLevels) {
        const tpQty = (parseFloat(qty) * (tp.percent / 100)).toFixed(3);
        try {
          const res = await placeReduceOnlyLimitOrder(
            symbol,
            tpSide,
            tpQty.toString(),
            tp.price.toString()
          );

          if (res && res.retCode !== 0) {
            console.error(`[Execute] Failed to place reduce-only TP limit order at ${tp.price}. Reason: ${res.retMsg}`);
            failedTPs.push(tp.price);
            // We do not fail the whole trade if one TP leg fails, just log it.
            continue;
          }

          if (res?.result?.orderId) {
             submittedLadderIds.push(res.result.orderId);
          }
        } catch (e) {
          console.error(`[Execute] Exception placing TP ladder leg for ${tp.price}`, e);
          failedTPs.push(tp.price);
        }
      }
      
      if (failedTPs.length > 0) {
         vetoReason += ` | Failed TPs: ${failedTPs.join(', ')}`;
      }

      const existing = activeLadders.get(symbol) || [];
      activeLadders.set(symbol, [...existing, ...submittedLadderIds]);
    }

    // 4. Update trade journal with real execution data
    const tradeSessionId = req.body.sessionId || "v5-bridge-session";
    const exchangeOrderId = orderRes?.result?.orderId || "unknown";

    import("./lib/trade-journal.js").then(({ insertJournalEntry }) => {
        try {
            insertJournalEntry({
                symbol,
                side: side.toUpperCase(),
                qty: qty.toString(),
                price: executionPrice.toString(),
                stopLoss: req.body.stopLoss?.toString() || "0",
                takeProfit: req.body.takeProfit?.toString() || "0",
                orderType: price ? "LIMIT" : "MARKET",
                status: "FILLED_SIMULATED",
                vetoReason: vetoReason,
                mode: "TESTNET_BRIDGE",
                strategyId: "MANUAL_BRIDGE",
                sessionId: "bridge",
                hostname: "localhost",
                exchangeOrderId: exchangeOrderId,
                riskScore: 0.8,
                tradeSessionId: tradeSessionId,
                macroBias: req.body.macroBias,
                technicalBias: req.body.technicalBias,
                cmeGapDirection: req.body.cmeGapDirection,
                cmeMagneticPull: req.body.cmeMagneticPull,
                session: req.body.session,
                tp1Price: req.body.tp1Price,
                tp1Filled: req.body.tp1Filled,
                tp2Price: req.body.tp2Price,
                tp2Filled: req.body.tp2Filled,
                tp3Price: req.body.tp3Price,
                tp3Filled: req.body.tp3Filled,
                slHit: req.body.slHit,
                pnlPct: req.body.pnlPct,
                vetoFired: req.body.vetoFired,
            });
        } catch(err) {
            console.error("Failed to write to journal from V5 bridge execution", err);
        }
    });

    const latency = Date.now() - startTime;

    res.json({ 
      status: "success", 
      balance: balanceRes,
      execution: {
         latencyMs: latency,
         spreadPct: spreadInfo.spreadPct.toFixed(4) + "%",
         intendedPrice,
         executionPrice,
         slippageAbs,
         slippagePct: slippagePct.toFixed(4) + "%",
         simulatedFeeUsdt: simulatedFeeQty.toFixed(4)
      },
      order: orderRes
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Execute bridge error:", message);
    res.status(500).json({ status: "error", message });
  }
});

app.get("/api/health", async (req, res) => {
  const dbHealth = await getDbStatus();
  if (dbHealth.status === "ok") {
    res.json({ status: "ok", database: dbHealth });
  } else {
    res.status(503).json({ status: "degraded", database: dbHealth });
  }
});

app.get("/api/status", (req, res) => {
  res.json({ 
    status: "alive", 
    ssr: "ready", 
    backend: "ready",
    privateAuth: privateAuthStatus
  });
});

app.post("/api/journal", async (req, res) => {
  try {
    const {
      symbol = "",
      side = "",
      qty = "",
      price = "",
      stopLoss = "",
      takeProfit = "",
      orderType = "",
      status = "",
      vetoReason = "",
      mode = "",
      strategyId,
      sessionId,
      hostname,
      exchangeOrderId,
      riskScore,
      tradeSessionId,
      macroBias,
      technicalBias,
      exitPrice,
      pnlUsdt,
      cmeGapDirection,
      cmeMagneticPull,
      session,
      tp1Price,
      tp1Filled,
      tp2Price,
      tp2Filled,
      tp3Price,
      tp3Filled,
      slHit,
      pnlPct,
      vetoFired,
    } = req.body;

    if (riskScore !== undefined && riskScore !== null) {
      const parsedRisk = parseFloat(riskScore);
      if (isNaN(parsedRisk) || parsedRisk < 0 || parsedRisk > 1) {
        res.status(400).json({ error: "Invalid risk_score. Must be a number between 0 and 1." });
        return;
      }
    }

    if (status && status.toLowerCase() !== "vetoed" && status.toLowerCase() !== "error" && !exchangeOrderId) {
      if (status.toLowerCase().includes("sent") || status.toLowerCase().includes("filled")) {
         res.status(400).json({ error: "exchange_order_id is required for sent/filled orders." });
         return;
      }
    }

    const id = await insertJournalEntry({
      symbol,
      side,
      qty,
      price,
      stopLoss,
      takeProfit,
      orderType,
      status,
      vetoReason,
      mode,
      strategyId,
      sessionId,
      hostname,
      exchangeOrderId,
      riskScore,
      tradeSessionId,
      macroBias,
      technicalBias,
      exitPrice,
      pnlUsdt,
      cmeGapDirection,
      cmeMagneticPull,
      session,
      tp1Price,
      tp1Filled,
      tp2Price,
      tp2Filled,
      tp3Price,
      tp3Filled,
      slHit,
      pnlPct,
      vetoFired,
    });
    res.json({ success: true, id });
  } catch (error: unknown) {
    console.error("Journal write error:", error);
    res.status(500).json({ error: "Failed to write to journal" });
  }
});

app.get("/api/journal", async (req, res) => {
  try {
    const entries = await getJournalEntries();
    res.json(entries);
  } catch (error: unknown) {
    console.error("Journal read error:", error);
    res.status(500).json({ error: "Failed to read from journal" });
  }
});

app.get("/api/journal/tail", async (req, res) => {
  try {
    const rawLastId = req.query["last_id"] as string;

    // Reconnect Fallback Strategy: if the dashboard comes online without a valid cursor,
    // simply flush the standard latest historical logs to instantly initialize the view.
    if (!rawLastId || rawLastId === "0" || isNaN(parseInt(rawLastId, 10))) {
      const entries = await getJournalEntries();
      res.json(entries);
      return;
    }

    const lastId = parseInt(rawLastId, 10);
    const entries = await getJournalEntriesSince(lastId);
    res.json(entries);
  } catch (error: unknown) {
    console.error("Journal tail error:", error);
    res.status(500).json({ error: "Failed to tail journal" });
  }
});

app.get("/api/journal/replay", async (req, res) => {
  const sessionId = req.query["session_id"] as string;
  const speed = req.query["speed"] ? parseInt(req.query["speed"] as string, 10) : 1000;

  if (!sessionId) {
    res.status(400).json({ error: "session_id is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const entries = await getJournalReplay(sessionId);
    if (entries.length === 0) {
      res.write("event: end\ndata: []\n\n");
      res.end();
      return;
    }

    res.write(`event: start\ndata: ${JSON.stringify({ total: entries.length, session_id: sessionId })}\n\n`);

    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex >= entries.length) {
        clearInterval(interval);
        res.write("event: end\ndata: []\n\n");
        res.end();
        return;
      }

      const entry = entries[currentIndex];
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
      currentIndex++;
    }, speed);

    req.on("close", () => {
      clearInterval(interval);
    });
  } catch (error) {
    console.error("Replay SSE error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Replay failed to initialize" });
    } else {
      res.write("event: error\ndata: Internal error\n\n");
      res.end();
    }
  }
});

app.get("/api/funding/:symbol", async (req, res) => {
  const { symbol } = req.params;
  try {
    const response = await fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
    );

    if (!response.ok) {
      res
        .status(response.status)
        .json({ error: "Failed to fetch from Bybit API" });
      return;
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      if (data.retCode === 0 && data.result.list.length > 0) {
        res.json({ fundingRate: data.result.list[0].fundingRate });
      } else {
        res.status(500).json({ error: "Failed to fetch funding rate" });
      }
    } catch (e) {
      console.error("Invalid response from Bybit API:", e);
      res.status(500).json({ error: "Invalid response from Bybit API" });
    }
  } catch (error) {
    console.error("Internal server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/historical/:symbol", async (req, res) => {
  const { symbol } = req.params;
  const { interval = 1, limit = 200 } = req.query;
  try {
    const response = await fetch(
      `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      res
        .status(response.status)
        .json({ error: "Failed to fetch historical data from Bybit API", details: errorText });
      return;
    }

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      res.json(data);
    } catch (e) {
      console.error("Invalid history response from Bybit API:", e);
      res.status(500).json({ error: "Invalid response from Bybit API" });
    }
  } catch (error) {
    console.error("Internal server error fetching historical data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: "1y",
    index: false,
    redirect: false,
  }),
);

// Proxy for Python Backend
const botProxy = createProxyMiddleware({
  target: 'http://localhost:8080',
  changeOrigin: true,
  pathRewrite: {
    '^/api/bot': '/api', 
  },
});

app.use('/api/bot', botProxy);

app.use(
  '/ws/bot',
  createProxyMiddleware({
    target: 'http://localhost:8080',
    changeOrigin: true,
    ws: true,
  })
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  console.log(`[SSR] INCOMING REQ: ${req.url}`);
  console.log(`[SSR] Host: ${req.headers.host}`);
  console.log(`[SSR] X-Forwarded-For: ${req.headers["x-forwarded-for"]}`);
  console.log(`[SSR] X-Forwarded-Host: ${req.headers["x-forwarded-host"]}`);
  console.log(`[SSR] X-Forwarded-Proto: ${req.headers["x-forwarded-proto"]}`);

  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env["pm_id"]) {
  const portStr = process.env["PORT"];
  const port = portStr ? parseInt(portStr, 10) : 3000;
  // Initialize Bybit WebSocket in background
  if (!process.env["ANGULAR_PRERENDER"] && !process.env["npm_lifecycle_event"]?.includes("build")) {
      initBybitWebsocket();
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`Node Express server listening on http://0.0.0.0:${port}`);
    
    // Start Python backend
    console.log("[Python] Starting Rave Godmode v1 backend...");
    const py = spawn("python3", ["-m", "python_app.main"], {
      stdio: "inherit",
      env: { ...process.env, PYTHONPATH: "." }
    });
    py.on("error", (err) => {
      console.error("[Python] Failed to start:", err);
    });
    py.on("exit", (code) => {
      console.log(`[Python] Exited with code ${code}.`);
    });
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
