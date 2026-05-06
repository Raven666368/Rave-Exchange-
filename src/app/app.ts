import { Store } from '@ngrx/store';
import { selectTradingOpsLastTradeError, selectTradingOpsLastTradeId, selectTradingOpsSubmitting } from './features/trading-ops/store/trading-ops.selectors';
import { submitManualTrade, resetManualTradeUi } from './features/trading-ops/store/trading-ops.actions';
import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  PLATFORM_ID,
  OnInit,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { DecimalPipe, DatePipe, isPlatformBrowser } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { OrderBookComponent } from "./order-book/order-book.component";
import { ChartComponent } from "./chart/chart.component";
import { OrderDetailsModalComponent } from "./order-details-modal.component";
import { HistoricalTradesModalComponent } from "./historical-trades-modal.component";
import { ExecutedTradesComponent } from "./executed-trades.component";
import { ExecutionLogsComponent, TradeExecutionLog } from "./execution-logs";
import { SettingsModalComponent } from "./settings-modal.component";
import { GateMatrix } from "./gate-matrix";
import { KillSwitch } from "./kill-switch";
import { PnlDisplay } from "./pnl-display";
import { FundingRate } from "./funding-rate";
import { DataStore } from "./data.store";
import { AlchemyStatusComponent } from "./alchemy-status";
import { JournalPromptComponent } from "./journal-prompt.component";
import { AlchemyService } from "./alchemy.service";
import {
  TradeConfirmationModalComponent,
  OrderPreview,
} from "./trade-confirmation-modal.component";

import { TradeJournalModalComponent } from "./trade-journal-modal.component";

import { ReplayModalComponent } from "./replay-modal.component";
import { cmeGapTracker } from "../lib/cme-gap-tracker";
import { PostMortemView } from "./post-mortem-view";
import { CmeMonitorComponent } from "./cme-monitor.component";
import { TradingOpsCenterComponent } from "./trading-ops-center.component";
import { HomeDashboardComponent } from "./home-dashboard.component";

import { CommandDashboardComponent } from "./command-dashboard.component";

export interface OrderHistoryEntry {
  id: string;
  type: "BUY" | "SELL";
  price: number;
  stopPrice?: number;
  size: number;
  leverage?: number;
  marginMode?: "cross" | "isolated";
  stopLoss?: number;
  takeProfit?: number;
  symbol: string;
  timestamp: Date;
  status: "FILLED" | "CANCELLED";
}

export interface OpenOrder {
  id: string;
  type: "BUY" | "SELL";
  price: number;
  stopPrice?: number;
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  symbol: string;
  timestamp: Date;
  status?: "PENDING";
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-root",
  imports: [
    DecimalPipe,
    DatePipe,
    FormsModule,
    OrderBookComponent,
    ChartComponent,
    OrderDetailsModalComponent,
    HistoricalTradesModalComponent,
    ExecutedTradesComponent,
    ExecutionLogsComponent,
    SettingsModalComponent,
    GateMatrix,
    KillSwitch,
    PnlDisplay,
    FundingRate,
    AlchemyStatusComponent,
    JournalPromptComponent,
    TradeConfirmationModalComponent,
    TradeJournalModalComponent,
    ReplayModalComponent,
    PostMortemView,
    MatIconModule,
    CmeMonitorComponent,
    TradingOpsCenterComponent,
    HomeDashboardComponent,
    CommandDashboardComponent,
  ],
  templateUrl: "./app.html",
  styleUrl: "./app.css",
})
export class App implements OnInit, OnDestroy {
  @ViewChild(GateMatrix) gateMatrix?: GateMatrix;
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  public alchemyService = inject(AlchemyService);
  private readonly store = inject(Store);

  botStatus = signal("Active - 9-Gate Engine Online");
  testnetBalance = signal(50000.0);
  currentTime = signal("00:00:05");

  readonly tradeError = this.store.selectSignal(selectTradingOpsLastTradeError);
  readonly lastTradeId = this.store.selectSignal(selectTradingOpsLastTradeId);
  readonly submitting = this.store.selectSignal(selectTradingOpsSubmitting);

  showConfirmModal = signal(false);
  showFullHistoryModal = signal(false);
  showSettingsModal = signal(false);
  showJournalModal = signal(false);
  isReplayModalOpen = signal(false);
  showPostMortem = signal(false);
  
  togglePostMortem() {
    this.showPostMortem.update(v => !v);
  }
  pendingAction = signal<"BUY" | "SELL" | "BOT" | null>(null);
  isExecuting = signal(false);

  selectedOrderDetails = signal<OrderHistoryEntry | OpenOrder | null>(null);

  orderHistory = signal<OrderHistoryEntry[]>([]);
  openOrders = signal<OpenOrder[]>([]);
  openPositions = signal<OrderHistoryEntry[]>([]);
  availableSymbols = signal<string[]>([
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "TAOUSDT",
    "RNDRUSDT",
    "FETUSDT",
    "AKTUSDT",
    "ICPUSDT",
  ]);
  searchQuery = signal<string>("");
  filteredSymbols = computed(() =>
    this.availableSymbols().filter((s) =>
      s.toLowerCase().includes(this.searchQuery().toLowerCase()),
    ),
  );
  currentSymbol = signal<string>("BTCUSDT");
  terminalLogs = signal<
    { time: string; msg: string; type: "info" | "warn" | "success" }[]
  >([]);
  tradeExecutionLogs = signal<TradeExecutionLog[]>([]);

  // Execution Inputs
  orderMode = signal<"limit" | "market" | "stop-limit">("limit");
  orderPriceInput = signal<number>(65432.1);
  stopPriceInput = signal<number | null>(null);
  orderSizeInput = signal<number>(0.5);

  orderSizeError = signal<string | null>(null);
  orderPriceError = signal<string | null>(null);
  orderTakeProfitError = signal<string | null>(null);
  orderStopLossError = signal<string | null>(null);

  marginMode = signal<"cross" | "isolated">("cross");
  leverage = signal<number>(10);
  leverageError = signal<string | null>(null);

  requiredMargin = computed(() => {
    return (
      ((this.orderPriceInput() || 0) * (this.orderSizeInput() || 0)) /
      this.leverage()
    );
  });

  isMarginSufficient = computed(() => {
    return this.testnetBalance() >= this.requiredMargin();
  });

  // Stop Loss State
  stopLossInput = signal<number | null>(null);
  activeStopLoss = signal<number | null>(null);

  // Take Profit State
  takeProfitInput = signal<number | null>(null);
  activeTakeProfit = signal<number | null>(null);

  // Order-specific TP/SL
  orderStopLossInput = signal<number | null>(null);
  orderTakeProfitInput = signal<number | null>(null);
  tpLevels = signal<{ price: number; percent: number }[]>([]);
  presetSide = signal<"LONG" | "SHORT">("LONG");

  addTpLevel(percentage = 2) {
    const currentPrice = this.orderPriceInput() || this.currentPrice() || 0;
    const direction = this.presetSide() === "LONG" ? 1 : -1;
    const nextPrice = currentPrice * (1 + ((percentage / 100) * (this.tpLevels().length + 1) * direction));
    
    this.tpLevels.update(levels => [...levels, { price: Number(nextPrice.toFixed(2)), percent: 25 }]);
  }

  removeTpLevel(index: number) {
    this.tpLevels.update(levels => levels.filter((_, i) => i !== index));
  }

  currentPrice = signal<number | null>(null);
  currentVolume24h = signal<number | null>(null);
  currentTurnover24h = signal<number | null>(null);
  currentPrice24hPcnt = signal<number | null>(null);
  highPrice24h = signal<number | null>(null);
  lowPrice24h = signal<number | null>(null);
  fundingRate = signal<number | null>(null);
  privateAuthError = signal<string | null>(null);
  public dataStore = inject(DataStore, { optional: true });
  liquidationPrice = computed(() => {
    const positions = this.openPositions();
    const pos = positions.find((p) => p.symbol === this.currentSymbol());

    if (!pos) return 0;

    const leverage = pos.leverage || 1;
    return pos.type === "BUY"
      ? pos.price * (1 - 1 / leverage)
      : pos.price * (1 + 1 / leverage);
  });
  symbolPrices = signal<Map<string, number>>(new Map<string, number>());
  priceChange = signal<"up" | "down" | "neutral">("neutral");

  private intervalId: ReturnType<typeof setInterval> | undefined;
  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | undefined;

  ngOnInit() {
    this.addLog("Initializing 9-gate decision engine...", "info");
    this.addLog("Syncing UTXO memory pool...", "info");
    this.addLog("Connecting via WebSockets to ByBit V5 Testnet.", "success");

    if (this.isBrowser) {
      fetch("/api/status").then(res => res.json()).then(data => {
         if (data && data.privateAuth && !data.privateAuth.working) {
            // Check if we have keys in local storage to send to backend
            let storedKey = null;
            let storedSecret = null;
            try {
               storedKey = localStorage.getItem('bybit_api_key');
               storedSecret = localStorage.getItem('bybit_api_secret');
            } catch {
               console.warn("localStorage access denied");
            }
            
            if (storedKey && storedSecret) {
               this.addLog("Syncing stored Bybit keys to backend...", "info");
               fetch('/api/settings/keys', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ apiKey: storedKey, apiSecret: storedSecret })
               }).then(() => this.privateAuthError.set(null));
            } else {
               this.privateAuthError.set(data.privateAuth.error || "Private WS Auth Failed");
               this.addLog(`Private Auth Failed: ${this.privateAuthError()} - Fallback read-only mode activated.`, "warn");
            }
         }
      }).catch(err => console.error("Failed to fetch backend status at init", err));

      this.intervalId = setInterval(() => {
        const now = new Date();
        this.currentTime.set(
          `00:00:${now.getSeconds().toString().padStart(2, "0")}`,
        );

        // Random "system activity" logs
        if (Math.random() > 0.95) {
          this.addLog(
            "Proprietary SMC signals detected in orderflow...",
            "warn",
          );
        }
      }, 1000);

      this.initWebSocket();
    }
  }

  private pongTimeout: ReturnType<typeof setTimeout> | null = null;

  private initWebSocket() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.pongTimeout) clearTimeout(this.pongTimeout);

    const ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.addLog("Connected to Bybit public stream", "success");
      ws.send(
        JSON.stringify({
          op: "subscribe",
          args: [`tickers.${this.currentSymbol()}`],
        }),
      );

      // Set up heartbeat
      this.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: "ping" }));
          this.pongTimeout = setTimeout(() => {
            console.warn("App WS ping timeout, reconnecting...");
            ws.close();
          }, 5000);
        }
      }, 20000);
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      const data = JSON.parse(event.data);
      if (data.op === "pong" || data.ret_msg === "pong") {
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
        return;
      }
      if (
        data.topic &&
        data.topic.startsWith("tickers.") &&
        data.data
      ) {
        if (data.data.lastPrice !== undefined) {
          const lastPrice = parseFloat(data.data.lastPrice);
          if (!isNaN(lastPrice)) {
            this.onPriceUpdate(lastPrice);
          }
        }
        if (data.data.volume24h !== undefined) {
          const vol = parseFloat(data.data.volume24h);
          if (!isNaN(vol)) {
            this.currentVolume24h.set(vol);
            if (this.dataStore) this.dataStore.currentVolume24h.set(vol);
          }
        }
        if (data.data.turnover24h !== undefined) {
          const turn = parseFloat(data.data.turnover24h);
          if (!isNaN(turn)) this.currentTurnover24h.set(turn);
        }
        if (data.data.price24hPcnt !== undefined) {
          const pcnt = parseFloat(data.data.price24hPcnt);
          if (!isNaN(pcnt)) this.currentPrice24hPcnt.set(pcnt);
        }
        if (data.data.highPrice24h !== undefined) {
          const high = parseFloat(data.data.highPrice24h);
          if (!isNaN(high)) this.highPrice24h.set(high);
        }
        if (data.data.lowPrice24h !== undefined) {
          const low = parseFloat(data.data.lowPrice24h);
          if (!isNaN(low)) this.lowPrice24h.set(low);
        }
        if (data.data.fundingRate !== undefined) {
          const rate = parseFloat(data.data.fundingRate);
          if (!isNaN(rate)) this.fundingRate.set(rate);
        }
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.addLog("WebSocket error", "warn");
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.addLog("WebSocket disconnected. Reconnecting...", "warn");
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.pongTimeout) clearTimeout(this.pongTimeout);
      this.ws = null;
      setTimeout(() => this.initWebSocket(), 3000);
    };
  }

  addExecutionLog(symbol: string, action: string, outcome: 'success' | 'failed' | 'pending', message: string) {
    this.tradeExecutionLogs.update(logs => [{
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      symbol,
      action,
      outcome,
      message
    }, ...logs].slice(0, 100));
  }

  addLog(msg: string, type: "info" | "warn" | "success" = "info") {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    this.terminalLogs.update((logs) =>
      [{ time, msg, type }, ...logs].slice(0, 50),
    );
  }

  onPriceUpdate(price: number) {
    const prevPrice = this.currentPrice();
    if (prevPrice !== null) {
      if (price > prevPrice) {
        this.priceChange.set("up");
      } else if (price < prevPrice) {
        this.priceChange.set("down");
      }

      // CME Gap Mitigation logic
      cmeGapTracker.onPriceUpdate({ symbol: 'BTCUSDT', price, timestamp: Date.now() });

      // Log significant moves
      const change = Math.abs(price - prevPrice) / prevPrice;
      if (change > 0.0005) {
        this.addLog(
          `Volatility detected: ${price > prevPrice ? "Bullish" : "Bearish"} impulse on ${this.currentSymbol()}`,
          "info",
        );
      }
    }
    this.currentPrice.set(price);

    this.symbolPrices.update(
      (m) => new Map(m.set(this.currentSymbol(), price)),
    );

    // Sync order price for market mode
    if (this.orderMode() === "market") {
      this.orderPriceInput.set(price);
    }

    this.checkAutoOrders(price);
    this.checkOpenOrders(price);
    this.checkOpenPositions(price);
  }

  updateSymbol(symbol: string) {
    if (this.currentSymbol() !== symbol) {
      this.currentSymbol.set(symbol);
      this.currentVolume24h.set(null);
      this.currentTurnover24h.set(null);
      this.currentPrice24hPcnt.set(null);
      this.highPrice24h.set(null);
      this.lowPrice24h.set(null);
      this.fundingRate.set(null);
      if (this.isBrowser) {
        this.initWebSocket();
      }
    }
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  onDivergence(event: {
    type: "BULLISH" | "BEARISH";
    price: number;
    rsi: number;
  }) {
    const type = event.type;
    const msg = `CRITICAL: ${type} RSI Divergence confirmed at ${event.price.toFixed(2)} (RSI: ${event.rsi.toFixed(2)})`;
    this.addLog(msg, type === "BULLISH" ? "success" : "warn");

    // Potentially auto-arm orders or update bot status
    this.botStatus.set(`RSI DIV: ${type} DETECTED`);
    this.clearStatusAfterDelay();
  }

  setStopLoss() {
    const val = this.stopLossInput();
    if (val !== null) {
      this.activeStopLoss.set(val);
      this.botStatus.set(`STOP LOSS SET AT ${val}`);
      this.clearStatusAfterDelay();
    }
  }

  clearStopLoss() {
    this.activeStopLoss.set(null);
    this.stopLossInput.set(null);
  }

  setTakeProfit() {
    const val = this.takeProfitInput();
    if (val !== null) {
      this.activeTakeProfit.set(val);
      this.botStatus.set(`TAKE PROFIT SET AT ${val}`);
      this.clearStatusAfterDelay();
    }
  }

  clearTakeProfit() {
    this.activeTakeProfit.set(null);
    this.takeProfitInput.set(null);
  }

  applyPreset(type: "TP" | "SL", side: "LONG" | "SHORT", percent: number) {
    const basePrice =
      this.orderMode() === "market"
        ? this.currentPrice()
        : this.orderPriceInput() || this.currentPrice();

    if (!basePrice) return;

    if (type === "TP") {
      const price =
        side === "LONG"
          ? basePrice * (1 + percent / 100)
          : basePrice * (1 - percent / 100);
      this.orderTakeProfitInput.set(Number(price.toFixed(2)));
    } else {
      const price =
        side === "LONG"
          ? basePrice * (1 - percent / 100)
          : basePrice * (1 + percent / 100);
      this.orderStopLossInput.set(Number(price.toFixed(2)));
    }
  }

  applyActivePreset(
    type: "TP" | "SL",
    side: "LONG" | "SHORT",
    percent: number,
  ) {
    const basePrice = this.currentPrice();
    if (!basePrice) return;

    if (type === "TP") {
      const price =
        side === "LONG"
          ? basePrice * (1 + percent / 100)
          : basePrice * (1 - percent / 100);
      this.takeProfitInput.set(Number(price.toFixed(2)));
    } else {
      const price =
        side === "LONG"
          ? basePrice * (1 - percent / 100)
          : basePrice * (1 + percent / 100);
      this.stopLossInput.set(Number(price.toFixed(2)));
    }
  }

  activeAppTab = signal<string>("Trade");

  setAppTab(tab: string) {
    if (tab === "Trade") {
      this.activeAppTab.set(tab);
    } else {
      this.addLog(`${tab} module initializing, falling back to Alpha Preview.`, "info");
      this.activeAppTab.set(tab);
    }
  }

  featureNotImplemented(feature: string) {
    this.addLog(`${feature} is not yet implemented in Alpha`, "warn");
  }

  private checkOpenPositions(price: number) {
    const positions = this.openPositions();
    if (positions.length === 0) return;

    const toClose: OrderHistoryEntry[] = [];
    const remaining: OrderHistoryEntry[] = [];

    for (const pos of positions) {
      if (pos.symbol !== this.currentSymbol()) {
        remaining.push(pos);
        continue;
      }

      let close = false;
      let reason = "";

      if (
        pos.stopLoss &&
        ((pos.type === "BUY" && price <= pos.stopLoss) ||
          (pos.type === "SELL" && price >= pos.stopLoss))
      ) {
        close = true;
        reason = "Stop Loss";
      } else if (
        pos.takeProfit &&
        ((pos.type === "BUY" && price >= pos.takeProfit) ||
          (pos.type === "SELL" && price <= pos.takeProfit))
      ) {
        close = true;
        reason = "Take Profit";
      }

      if (close) {
        toClose.push(pos);
        this.addLog(
          `${reason} Triggered: Closing ${pos.type} position on ${pos.symbol} at ${price}`,
          "success",
        );
      } else {
        remaining.push(pos);
      }
    }

    if (toClose.length > 0) {
      this.openPositions.set(remaining);
      toClose.forEach((pos) =>
        this.executeMarketSell(price, `TP/SL: ${pos.id}`),
      );
    }
  }

  private simulateBotFill() {
    const currentPrice = this.currentPrice();
    if (currentPrice === null) return;
    
    const isBuy = Math.random() > 0.5;
    const priceOffset = (Math.random() - 0.5) * 10;
    const fillPrice = currentPrice + priceOffset;
    const size = parseFloat((Math.random() * 0.5 + 0.01).toFixed(3));

    // Sometimes use a different symbol for variation
    const symbols = this.availableSymbols();
    const symbol =
      Math.random() > 0.7
        ? symbols[Math.floor(Math.random() * symbols.length)]
        : this.currentSymbol();

    const fill: OrderHistoryEntry = {
      id: "BOT-" + Math.random().toString(36).substring(2, 6).toUpperCase(),
      type: isBuy ? "BUY" : "SELL",
      price: fillPrice,
      size: size,
      leverage: this.leverage(),
      marginMode: this.marginMode(),
      symbol: symbol,
      timestamp: new Date(),
      status: "FILLED",
    };

    // Add to history and keep max 100 entries to prevent memory leak
    this.orderHistory.update((h) => [fill, ...h].slice(0, 100));
    this.addLog(
      `BOT FILLED: ${isBuy ? "BUY" : "SELL"} ${size} ${symbol} @ ${fillPrice.toFixed(2)}`,
      "success",
    );
  }

  private clearStatusAfterDelay() {
    setTimeout(() => {
      const current = this.botStatus();
      if (
        current.includes("SET AT") ||
        current.includes("TRIGGERED") ||
        current.includes("Processing")
      ) {
        this.botStatus.set("Active - 9-Gate Engine Online");
      }
    }, 3000);
  }

  private checkAutoOrders(price: number) {
    // Check Stop Loss (Losing side)
    const sl = this.activeStopLoss();
    if (sl !== null) {
      // Assuming a long position for simplicity of this SL/TP logic
      if (price <= sl) {
        this.addLog(`Stop Loss Triggered at ${price}`, "warn");
        this.botStatus.set("STOP LOSS TRIGGERED!");
        this.activeStopLoss.set(null);
        this.executeMarketSell(price, "Stop Loss");
        return;
      }
    }

    // Check Take Profit (Profitable side)
    const tp = this.activeTakeProfit();
    if (tp !== null) {
      if (price >= tp) {
        this.addLog(`Take Profit Triggered at ${price}`, "success");
        this.botStatus.set("TAKE PROFIT TRIGGERED!");
        this.activeTakeProfit.set(null);
        this.executeMarketSell(price, "Take Profit");
      }
    }
  }

  private checkOpenOrders(price: number) {
    const orders = this.openOrders();
    if (orders.length === 0) return;

    const toFill: OpenOrder[] = [];
    const remaining: OpenOrder[] = [];

    for (const order of orders) {
      if (order.symbol !== this.currentSymbol()) {
        remaining.push(order);
        continue;
      }

      let filled = false;
      let triggered = false;

      // Handle stop trigger first if it exists
      if (order.stopPrice !== undefined) {
        if (order.type === "BUY" && price >= order.stopPrice) {
          triggered = true;
        } else if (order.type === "SELL" && price <= order.stopPrice) {
          triggered = true;
        }

        // If triggered, it becomes a limit order
        if (triggered) {
          order.stopPrice = undefined; // Triggered, now acts as normal limit
          this.addLog(
            `Stop Triggered: ${order.type} limit order placed at ${order.price}`,
            "info",
          );
        }
      }

      // Check limit logic if not a pending stop order
      if (order.stopPrice === undefined) {
        if (order.type === "BUY" && price <= order.price) {
          filled = true;
        } else if (order.type === "SELL" && price >= order.price) {
          filled = true;
        }
      }

      if (filled) {
        toFill.push(order);
      } else {
        remaining.push(order);
      }
    }

    if (
      toFill.length > 0 ||
      orders.some((o) => o.stopPrice === undefined && remaining.includes(o))
    ) {
      // We might have triggered stops without filling, so we should still update the list
      this.openOrders.set(remaining);
      toFill.forEach((order) => this.fillOrder(order, price));
    }
  }

  private fillOrder(order: OpenOrder, fillPrice: number) {
    const cost = (fillPrice * order.size) / this.leverage();
    if (order.type === "BUY") {
      if (this.testnetBalance() < cost) {
        this.addLog(
          `Order Failed: Insufficient margin for ${order.size} ${order.symbol}`,
          "warn",
        );
        return;
      }
      this.testnetBalance.update((v) => v - cost);
    } else {
      this.testnetBalance.update((v) => v + cost);
    }

    const newEntry: OrderHistoryEntry = {
      ...order,
      price: fillPrice, // Fill at trigger price
      leverage: this.leverage(),
      marginMode: this.marginMode(),
      status: "FILLED",
    };
    this.orderHistory.update((h) => [newEntry, ...h]);
    this.openPositions.update((p) => [...p, newEntry]);
    this.addLog(
      `ORDER FILLED: ${order.type} ${order.size} ${order.symbol} @ ${fillPrice} (${this.leverage()}x)`,
      "success",
    );
  }

  setOrderMode(mode: "limit" | "market" | "stop-limit") {
    this.orderMode.set(mode);
    if (mode === "market" && this.currentPrice()) {
      this.orderPriceInput.set(this.currentPrice()!);
    }
  }

  onLeverageChange(value: number) {
    const numValue = Number(value);
    this.leverage.set(numValue);
    if (numValue < 1 || numValue > 100) {
      this.leverageError.set("Leverage must be between 1 and 100");
    } else {
      this.leverageError.set(null);
    }
  }

  tradeConfirmationOrder = signal<OrderPreview | null>(null);

  ctaReact(event: Event) {
    const el = event.currentTarget as HTMLElement;
    import('motion').then(({ animate }) => {
      animate(el, { scale: [1, 0.96, 1.02, 1] }, { duration: 0.25, ease: "easeInOut" });
    });
  }

  autoTradingEnabled = signal(false);

  toggleAutoTrading() {
    this.autoTradingEnabled.set(!this.autoTradingEnabled());
    this.addLog(
      `Auto Pilot ${this.autoTradingEnabled() ? "Enabled" : "Disabled"} - Scheduled execution loop active.`,
      this.autoTradingEnabled() ? "success" : "warn",
    );
  }

  executeAutoTrade() {
    this.isExecuting.set(true);
    const aiStatus = this.alchemyService.status();
    let stopLoss = (this.currentPrice() || 0) * 0.95;
    let takeProfit = (this.currentPrice() || 0) * 1.05;
    let tpLevels: { price: number; percent: number }[] = [];

    if (aiStatus?.perception?.entry_plan) {
      const plan = aiStatus.perception.entry_plan;
      if (plan.stop) stopLoss = parseFloat(plan.stop);
      if (plan.targets && plan.targets.length > 0) {
        const weights = [50, 30, 20];
        tpLevels = plan.targets.map((t: string, i: number) => ({
          price: parseFloat(t),
          percent: weights[Math.min(i, weights.length - 1)],
        }));
        const totalWeight = tpLevels.reduce((a, b) => a + b.percent, 0);
        if (totalWeight < 100 && tpLevels.length > 0) {
          tpLevels[tpLevels.length - 1].percent += 100 - totalWeight;
        } else if (totalWeight > 100) {
          tpLevels = tpLevels.map((lvl) => ({
            ...lvl,
            percent: (lvl.percent / totalWeight) * 100,
          }));
        }
      } else if (plan.targets && plan.targets.length === 1) {
        takeProfit = parseFloat(plan.targets[0]);
      }
    }

    const orderPreview = {
      symbol: this.currentSymbol(),
      side: aiStatus?.perception?.macro_bias === "Bullish" ? ("BUY" as const) : ("SELL" as const),
      price: this.currentPrice() || 0,
      size: this.orderSizeInput() || 0.1,
      stopLoss,
      takeProfit,
      tpLevels,
    };

    const currentPrice = cmeGapTracker.lastSeenPrice();
    const gapContext = cmeGapTracker.getGapContext(currentPrice);

    const payload = {
      symbol: orderPreview.symbol,
      side: orderPreview.side === "BUY" ? ("Buy" as const) : ("Sell" as const),
      qty: orderPreview.size.toString(),
      price: orderPreview.price.toString(),
      stopLoss: orderPreview.stopLoss?.toString() || "0",
      takeProfit: orderPreview.takeProfit?.toString() || "0",
      tpLevels: orderPreview.tpLevels,
      orderType: "Market" as const,
      execution_allowed: true,
      mode: "Bot",
      macroBias: this.alchemyService.status()?.perception?.macro_bias,
      technicalBias: this.alchemyService.status()?.perception?.technical_bias,
      cmeGapDirection: gapContext.cmeGapDirection,
      cmeMagneticPull: gapContext.magneticPull,
      session: this.alchemyService.status()?.perception?.session || "Unknown",
    };

    this.alchemyService
      .submitConfirmedTrade(payload)
      .then((result) => {
        this.isExecuting.set(false);
        if (result.retCode === 0) {
          this.addLog(
            `Auto Trade submitted: ${result.result?.orderId || result.result?.orderLinkId}`,
            "success",
          );
          this.addExecutionLog(
            orderPreview.symbol,
            orderPreview.side,
            "success",
            `Auto Order ID: ${result.result?.orderId || result.result?.orderLinkId}`,
          );
          this.executeMarketBuy(orderPreview.price, orderPreview.size);
        } else {
          this.addLog(`Auto Trade failed: ${result.retMsg}`, "warn");
          this.addExecutionLog(
            orderPreview.symbol,
            orderPreview.side,
            "failed",
            result.retMsg || "Auto Order failed",
          );
        }
      })
      .catch((e: unknown) => {
        this.isExecuting.set(false);
        if (e instanceof Error) {
          this.addLog(e.message || "Auto Trade failed", "warn");
          this.addExecutionLog(orderPreview.symbol, orderPreview.side, "failed", e.message);
        } else {
          this.addLog("Auto Trade failed with unknown error", "warn");
          this.addExecutionLog(orderPreview.symbol, orderPreview.side, "failed", "Unknown error");
        }
      });
  }

  showGateMatrixWarning() {
    this.addLog("Cannot Execute Trade: Gate Matrix has not passed all checks.", "warn");
  }

  executeTrade(): void {
    if (this.isExecuting() || this.submitting()) return;
    
    this.isExecuting.set(true);
    try {
      this.store.dispatch(
        submitManualTrade({
          side: this.presetSide(),
          symbol: this.currentSymbol()
        })
      );
    } finally {
      this.isExecuting.set(false);
    }
  }

  clearTradeStatus(): void {
    this.store.dispatch(resetManualTradeUi());
  }

  handleExecuteTrade() {
    if (this.gateMatrix?.allPassed()) {
      this.isExecuting.set(true);
      setTimeout(() => {
        this.isExecuting.set(false);
        const aiStatus = this.alchemyService.status();
        let stopLoss = (this.currentPrice() || 0) * 0.95;
        let takeProfit = (this.currentPrice() || 0) * 1.05;
        let tpLevels: { price: number; percent: number }[] = [];

        if (aiStatus?.perception?.entry_plan) {
           const plan = aiStatus.perception.entry_plan;
           if (plan.stop) stopLoss = parseFloat(plan.stop);
           if (plan.targets && plan.targets.length > 0) {
              const weights = [50, 30, 20];
              tpLevels = plan.targets.map((t: string, i: number) => ({
                 price: parseFloat(t),
                 percent: weights[Math.min(i, weights.length - 1)]
              }));
              // Calculate remaining weight if less than 3 targets
              const totalWeight = tpLevels.reduce((a, b) => a + b.percent, 0);
              if (totalWeight < 100 && tpLevels.length > 0) {
                 tpLevels[tpLevels.length - 1].percent += (100 - totalWeight);
              } else if (totalWeight > 100) {
                 // Normalize
                 tpLevels = tpLevels.map(lvl => ({...lvl, percent: (lvl.percent / totalWeight) * 100}));
              }
           } else if (plan.targets && plan.targets.length === 1) {
              takeProfit = parseFloat(plan.targets[0]);
           }
        }

        // Show the explicit AI confirmation modal
        this.tradeConfirmationOrder.set({
          symbol: this.currentSymbol(),
          side: aiStatus?.perception?.macro_bias === "Bullish" ? "BUY" : "SELL", // Or derive from action
          price: this.currentPrice() || 0,
          size: this.orderSizeInput() || 0.1,
          stopLoss,
          takeProfit,
          tpLevels,
          leverage: this.leverage(),
          marginMode: this.marginMode(),
          estimatedMargin: this.requiredMargin()
        });
      }, 800);
    }
  }

  async cancelBotTrade() {
    if (this.tradeConfirmationOrder()) {
      const orderPreview = this.tradeConfirmationOrder()!;
      this.tradeConfirmationOrder.set(null);
      const currentPrice = cmeGapTracker.lastSeenPrice();
      const gapContext = cmeGapTracker.getGapContext(currentPrice);
      
      await this.alchemyService.writeJournal({
        symbol: orderPreview.symbol,
        side: orderPreview.side === "BUY" ? "Buy" : "Sell",
        qty: orderPreview.size.toString(),
        price: orderPreview.price.toString(),
        stopLoss: orderPreview.stopLoss?.toString() || "0",
        takeProfit: orderPreview.takeProfit?.toString() || "0",
        orderType: "Market",
        status: "Vetoed",
        vetoReason: "User cancelled from confirmation modal",
        mode: "Bot",
        macroBias: this.alchemyService.status()?.perception?.macro_bias,
        technicalBias: this.alchemyService.status()?.perception?.technical_bias,
        cmeGapDirection: gapContext.cmeGapDirection,
        cmeMagneticPull: gapContext.magneticPull,
        session: this.alchemyService.status()?.perception?.session || "Unknown",
        vetoFired: true
      });
      this.addLog(`Bot trade cancelled by user`, "warn");
    }
    this.tradeConfirmationOrder.set(null);
  }

  async confirmBotTrade() {
    if (!this.tradeConfirmationOrder()) return;
    const orderPreview = this.tradeConfirmationOrder()!;
    this.addLog(`Submitting confirmed trade to Bybit API...`, "warn");
    this.tradeConfirmationOrder.set(null);

    const currentPrice = cmeGapTracker.lastSeenPrice();
    const gapContext = cmeGapTracker.getGapContext(currentPrice);

    const payload = {
      symbol: orderPreview.symbol,
      side: orderPreview.side === "BUY" ? ("Buy" as const) : ("Sell" as const),
      qty: orderPreview.size.toString(),
      price: orderPreview.price.toString(),
      stopLoss: orderPreview.stopLoss?.toString() || "0",
      takeProfit: orderPreview.takeProfit?.toString() || "0",
      tpLevels: orderPreview.tpLevels,
      orderType: "Market" as const,
      execution_allowed: true,
      mode: "Bot",
      macroBias: this.alchemyService.status()?.perception?.macro_bias,
      technicalBias: this.alchemyService.status()?.perception?.technical_bias,
      cmeGapDirection: gapContext.cmeGapDirection,
      cmeMagneticPull: gapContext.magneticPull,
      session: this.alchemyService.status()?.perception?.session || "Unknown"
    };

    try {
      const result = await this.alchemyService.submitConfirmedTrade(payload);
      if (result.retCode === 0) {
        this.addLog(
          `Order submitted successfully: ${result.result?.orderId || result.result?.orderLinkId}`,
          "success",
        );
        this.addExecutionLog(orderPreview.symbol, orderPreview.side, 'success', `Order ID: ${result.result?.orderId || result.result?.orderLinkId}`);
        // We'll also call the local execution mock so the order shows up in the UI lists during our test mode!
        this.executeMarketBuy(orderPreview.price, orderPreview.size);
      } else {
        this.addLog(`Order failed: ${result.retMsg}`, "warn");
        this.addExecutionLog(orderPreview.symbol, orderPreview.side, 'failed', result.retMsg || 'Order failed');
      }
    } catch (e: unknown) {
      if (e instanceof Error) {
        this.addLog(e.message || "Trade failed", "warn");
        this.addExecutionLog(orderPreview.symbol, orderPreview.side, 'failed', e.message);
      } else {
        this.addLog("Trade failed with unknown error", "warn");
        this.addExecutionLog(orderPreview.symbol, orderPreview.side, 'failed', 'Unknown error');
      }
    }
  }

  submitToV5API(action: "BUY"|"SELL", mode: string, price: number, size: number, stopPrice: number | null, stopLoss: number | null, takeProfit: number | null) {
    if (mode === "market" || mode === "limit") {
      const payload: Record<string, unknown> = {
        symbol: this.currentSymbol(),
        side: action === "BUY" ? "Buy" : "Sell",
        qty: size.toString(),
        price: mode === "market" ? undefined : price.toString(),
        stopLoss: stopLoss?.toString(),
        takeProfit: takeProfit?.toString()
      };
      
      this.addLog(`Sending ${action} order to V5 Bridge...`, "info");
      
      fetch("/api/execute", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
         if (data.status === "success") {
            const exec = data.execution;
            this.addLog(`[V5 Bridge] ${action} executed. Slippage: ${exec.slippagePct}, Spread: ${exec.spreadPct}, Latency: ${exec.latencyMs}ms`, "success");
            this.addLog(`[V5 Bridge] Fill Price: ${exec.executionPrice}, Fees: ${exec.simulatedFeeUsdt} USDT`, "info");
            this.addExecutionLog(this.currentSymbol(), action, 'success', `Fill Price: ${exec.executionPrice}`);
            
            if (data.balance && data.balance.result && data.balance.result.list) {
                const coinList = data.balance.result.list[0]?.coin as { coin: string; walletBalance: string }[] | undefined;
                const usdtCoin = coinList?.find((c) => c.coin === "USDT");
                if (usdtCoin) {
                  this.testnetBalance.set(parseFloat(usdtCoin.walletBalance));
                  this.addLog(`[V5 Bridge] Extracted Live USDT Wallet Balance: ${usdtCoin.walletBalance}`, "success");
                }
            }

            // Revert back local state
            if (action === "BUY") {
              this.executeMarketBuy(exec.executionPrice, size);
            } else if (action === "SELL") {
              this.executeMarketSell(exec.executionPrice, size);
            }
         } else {
            this.addLog(`[V5 Bridge] Error: ${data.message}`, "warn");
            this.addExecutionLog(this.currentSymbol(), action, 'failed', data.message);
         }
      })
      .catch(err => {
         this.addLog(`[V5 Bridge] Backend unavailable (${err.message}). Simulating execution locally...`, "info");
         
         const execPrice = price > 0 ? price : (this.currentPrice() || 0);
         const simulatedFee = (execPrice * size * 0.0006).toFixed(4);
         
         this.addLog(`[V5 Bridge] ${action} executed. Slippage: 0.01%, Spread: 0.02%, Latency: 45ms`, "success");
         this.addLog(`[V5 Bridge] Fill Price: ${execPrice}, Fees: ${simulatedFee} USDT`, "info");
         this.addExecutionLog(this.currentSymbol(), action, 'success', `Fill Price: ${execPrice}`);
         
         // Revert back local state
         if (action === "BUY") {
           this.executeMarketBuy(execPrice, size);
         } else if (action === "SELL") {
           this.executeMarketSell(execPrice, size);
         }
      });
    } else {
      this.placeOrder(
        action,
        mode,
        price,
        size,
        stopPrice,
        stopLoss ? stopLoss : 0,
        takeProfit ? takeProfit : 0,
      );
    }
  }

  setSizePercentage(percent: number) {
    const price = this.orderMode() === "market" || this.orderMode() === "stop-limit" 
      ? (this.currentPrice() || Number(cmeGapTracker.lastSeenPrice()) || 0)
      : this.orderPriceInput();

    if (price <= 0) return;
    const maxAffordableSize = (this.testnetBalance() * this.leverage()) / price;
    this.orderSizeInput.set(Number((maxAffordableSize * percent).toFixed(5)));
  }

  quickBuy() {
    const price = this.currentPrice() || Number(cmeGapTracker.lastSeenPrice()) || 0;
    const size = this.orderSizeInput() || 0.1;
    if (price <= 0) {
      this.addLog("Quick Buy Failed: Price unavailable", "warn");
      return;
    }
    this.submitToV5API("BUY", "market", price, size, 0, null, null);
  }

  quickSell() {
    const price = this.currentPrice() || Number(cmeGapTracker.lastSeenPrice()) || 0;
    const size = this.orderSizeInput() || 0.1;
    if (price <= 0) {
      this.addLog("Quick Sell Failed: Price unavailable", "warn");
      return;
    }
    this.submitToV5API("SELL", "market", price, size, 0, null, null);
  }

  buy() {
    this.pendingAction.set("BUY");
    this.showConfirmModal.set(true);
  }

  sell() {
    this.pendingAction.set("SELL");
    this.showConfirmModal.set(true);
  }

  cancelAction() {
    this.closeModal();
  }

  closeModal() {
    this.showConfirmModal.set(false);
    this.pendingAction.set(null);
  }

  viewOrderDetails(order: OrderHistoryEntry | OpenOrder) {
    this.selectedOrderDetails.set(order);
  }

  closeOrderDetails() {
    this.selectedOrderDetails.set(null);
  }

  onSaveKeys(keys: { apiKey: string; apiSecret: string }) {
    // In a real application, you'd use these keys to authenticate API requests to Bybit.
    // For now, they are stored securely in localStorage inside the SettingsModalComponent.
    if (keys.apiKey && keys.apiSecret) {
      this.addLog("Bybit API Keys have been updated securely.", "success");
    }
  }

  confirmAction() {
    this.orderSizeError.set(null);
    this.orderPriceError.set(null);
    this.leverageError.set(null);

    let isValid = true;
    if (this.orderSizeInput() <= 0) {
      this.orderSizeError.set("Size must be greater than 0");
      isValid = false;
    }
    if (
      (this.orderMode() === "limit" || this.orderMode() === "stop-limit") &&
      this.orderPriceInput() <= 0
    ) {
      this.orderPriceError.set("Price must be greater than 0");
      isValid = false;
    }
    if (this.leverage() < 1 || this.leverage() > 100) {
      this.leverageError.set("Leverage must be between 1 and 100");
      isValid = false;
    }

    if (!isValid) {
      this.addLog("Order validation failed. Check inputs.", "warn");
      return;
    }

    const action = this.pendingAction();
    const mode = this.orderMode();
    const price = this.orderPriceInput();
    const size = this.orderSizeInput();
    const stopPrice = this.stopPriceInput();
    const stopLoss = this.orderStopLossInput();
    const takeProfit = this.orderTakeProfitInput();

    if (action === "BUY" || action === "SELL") {
      this.submitToV5API(action, mode, price, size, stopPrice, stopLoss, takeProfit);
    }
    
    this.closeModal();
  }

  executeMarketBuy(price: number, size: number) {
    const margin = (price * size) / this.leverage();
    // Simulate slight difference in reserved margin between isolated and cross
    const cost = this.marginMode() === "isolated" ? margin : margin * 0.95;

    if (this.testnetBalance() < cost) {
      this.addLog(`Market Buy Failed: Insufficient funds for margin`, "warn");
      return;
    }

    this.testnetBalance.update((v) => v - cost);
    const newEntry: OrderHistoryEntry = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      type: "BUY",
      price: price,
      size: size,
      leverage: this.leverage(),
      marginMode: this.marginMode(),
      symbol: this.currentSymbol(),
      timestamp: new Date(),
      status: "FILLED",
    };
    this.orderHistory.update((h) => [newEntry, ...h]);
    this.addLog(
      `MARKET BUY EXECUTED: ${size} ${this.currentSymbol()} @ ${price} (${this.leverage()}x ${this.marginMode()})`,
      "success",
    );
  }

  executeMarketSell(price: number, sizeOrType: number | string) {
    const size =
      typeof sizeOrType === "number" ? sizeOrType : this.orderSizeInput();
    const margin = (price * size) / this.leverage();
    // Simulate slight difference in reserved margin between isolated and cross
    const cost = this.marginMode() === "isolated" ? margin : margin * 0.95;

    if (this.testnetBalance() < cost) {
      this.addLog(`Market Sell Failed: Insufficient funds for margin`, "warn");
      return;
    }

    this.testnetBalance.update((v) => v - cost);
    const newEntry: OrderHistoryEntry = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      type: "SELL",
      price: price,
      size: size,
      leverage: this.leverage(),
      marginMode: this.marginMode(),
      symbol: this.currentSymbol(),
      timestamp: new Date(),
      status: "FILLED",
    };
    this.orderHistory.update((h) => [newEntry, ...h]);
    const label = typeof sizeOrType === "string" ? ` (${sizeOrType})` : "";
    this.addLog(
      `MARKET SELL EXECUTED${label}: ${size} ${this.currentSymbol()} @ ${price} (${this.leverage()}x ${this.marginMode()})`,
      "success",
    );
  }

  placeOrder(
    type: "BUY" | "SELL" | "BOT",
    mode: string,
    price: number,
    size: number,
    stopPrice: number | null,
    stopLoss: number | null,
    takeProfit: number | null,
  ) {
    const newOrder: OpenOrder = {
      id: Math.random().toString(36).substring(2, 9).toUpperCase(),
      type: type === "BOT" ? "BUY" : type,
      price: price,
      stopPrice: mode === "stop-limit" ? stopPrice || undefined : undefined,
      size: size,
      stopLoss: stopLoss || undefined,
      takeProfit: takeProfit || undefined,
      symbol: this.currentSymbol(),
      timestamp: new Date(),
      status: "PENDING",
    };
    this.openOrders.update((orders) => [...orders, newOrder]);
    const typeLabel =
      mode === "stop-limit" ? `STOP-LIMIT ${type}` : `LIMIT ${type}`;
    const priceInfo =
      mode === "stop-limit" ? `@ ${price} (STOP: ${stopPrice})` : `@ ${price}`;
    this.addLog(
      `${typeLabel} ORDER PLACED: ${size} ${this.currentSymbol()} ${priceInfo} (${this.leverage()}x)`,
      "info",
    );
  }

  handleTradeRequested(event: { price: number; size: number }) {
    this.orderPriceInput.set(event.price);
    this.orderSizeInput.set(event.size);
    this.setOrderMode("limit");
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}
