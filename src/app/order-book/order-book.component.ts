import { ChangeDetectionStrategy, Component, signal, OnDestroy, OnInit, inject, PLATFORM_ID, input, effect, output } from '@angular/core';
import { isPlatformBrowser, DecimalPipe } from '@angular/common';
import { DataStore } from '../data.store';

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
}

@Component({
  selector: 'app-order-book',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './order-book.component.html',
})
export class OrderBookComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private dataStore = inject(DataStore, { optional: true });
  private isBrowser = isPlatformBrowser(this.platformId);
  
  symbol = input<string>('BTCUSDT');
  tradeRequested = output<{price: number, size: number}>();

  asks = signal<OrderBookEntry[]>([]);
  bids = signal<OrderBookEntry[]>([]);
  
  isLoading = signal<boolean>(true);
  error = signal<string | null>(null);
  spread = signal<number>(0);
  midPrice = signal<number>(0);
  maxTotal = signal<number>(1);
  minSizeFilter = signal<number>(0);

  private ws: WebSocket | null = null;
  private askMap = new Map<number, number>();
  private bidMap = new Map<number, number>();
  displayDepth = signal<number>(20);

  constructor() {
    effect(() => {
      this.symbol(); // Track dependency
      if (this.isBrowser) {
        if (this.ws) {
          this.ws.close();
        }
        this.askMap.clear();
        this.bidMap.clear();
        this.asks.set([]);
        this.bids.set([]);
        this.isLoading.set(true);
        this.connectWs();
      }
    });
  }

  ngOnInit() {
    // Initial connection handled by effect
    console.log('OrderBook component initialized');
  }

  updateSizeFilter(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value) || 0;
    this.minSizeFilter.set(value);
    this.processMaps();
  }

  updateDepth(event: Event) {
    const input = event.target as HTMLSelectElement;
    const value = parseInt(input.value) || 15;
    this.displayDepth.set(value);
    this.processMaps();
  }

  private pingInterval: ReturnType<typeof setInterval> | undefined;
  private pongTimeout: ReturnType<typeof setTimeout> | undefined;
  
  private connectWs() {
    if (!this.isBrowser) return;
    this.isLoading.set(true);
    this.error.set(null);

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.pongTimeout) clearTimeout(this.pongTimeout);

    const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    this.ws = ws;

    const connectionTimeout = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) {
            this.error.set('Connection timeout (Fallback Mode)');
            this.isLoading.set(false);
            // We don't close here, we just show error so it's not spinning forever
        }
    }, 5000);

    ws.onopen = () => {
      clearTimeout(connectionTimeout);
      if (this.ws !== ws) return;
      this.isLoading.set(false);
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [`orderbook.50.${this.symbol()}`]
      }));
      this.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
          this.pongTimeout = setTimeout(() => {
            console.warn('OrderBook WS ping timeout, reconnecting...');
            ws.close();
          }, 5000);
        }
      }, 20000);
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.ret_msg === 'pong' || msg.op === 'pong') {
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = undefined;
          }
          return;
        }
        if (msg.topic === `orderbook.50.${this.symbol()}` && msg.data) {
          console.log('Orderbook message received:', msg);
          if (msg.type === 'snapshot') {
            this.askMap.clear();
            this.bidMap.clear();
          }
          this.updateMap(this.askMap, msg.data.a);
          this.updateMap(this.bidMap, msg.data.b);
          this.processMaps();
        }
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };

    ws.onerror = () => {
      if (this.ws !== ws) return;
      this.error.set('WebSocket connection error');
      this.isLoading.set(false);
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
      if (this.pongTimeout) {
        clearTimeout(this.pongTimeout);
      }
      if (!this.error()) {
        this.error.set('WebSocket disconnected');
      }
      setTimeout(() => this.connectWs(), 5000);
    };
  }

  private updateMap(map: Map<number, number>, items: [string, string][]) {
    if (!items || !Array.isArray(items)) return;
    for (const [priceStr, sizeStr] of items) {
      if (priceStr === null || priceStr === undefined || sizeStr === null || sizeStr === undefined) continue;
      const price = parseFloat(priceStr);
      const size = parseFloat(sizeStr);
      
      if (isNaN(price) || isNaN(size)) continue;

      if (size === 0) {
        map.delete(price);
      } else {
        map.set(price, size);
      }
    }
  }

  public processMaps() {
    const minSize = this.minSizeFilter();

    // Top 15 asks, ascending based on price
    const ascendingAsks = Array.from(this.askMap.entries())
      .filter(([price, size]) => !isNaN(price) && !isNaN(size) && size >= minSize)
      .sort((a, b) => a[0] - b[0])
      .slice(0, this.displayDepth());
    
    let askTotal = 0;
    const askEntries: OrderBookEntry[] = [];
    
    // We want highest ask at the top, lowest immediately above spread
    for (const [price, size] of ascendingAsks) {
      askTotal += size;
      askEntries.unshift({ price, size, total: askTotal }); // unshift puts lowest ask at bottom
    }
    
    // Top 15 bids, descending based on price
    const descendingBids = Array.from(this.bidMap.entries())
      .filter(([price, size]) => !isNaN(price) && !isNaN(size) && size >= minSize)
      .sort((a, b) => b[0] - a[0])
      .slice(0, this.displayDepth());

    let bidTotal = 0;
    const bidEntries: OrderBookEntry[] = [];
    
    // Bids at top should be highest price
    for (const [price, size] of descendingBids) {
      bidTotal += size;
      bidEntries.push({ price, size, total: bidTotal });
    }

    this.asks.set(askEntries);
    this.bids.set(bidEntries);

    const lowestAsk = ascendingAsks[0]?.[0];
    const highestBid = descendingBids[0]?.[0];

    if (lowestAsk !== undefined && highestBid !== undefined && !isNaN(lowestAsk) && !isNaN(highestBid)) {
      const sp = Number((lowestAsk - highestBid).toFixed(2));
      this.spread.set(sp);
      if (this.dataStore) {
        this.dataStore.spread.set(sp);
      }
      this.midPrice.set(Number(((lowestAsk + highestBid) / 2).toFixed(2)));
    } else {
      this.spread.set(0);
      if (this.dataStore) {
        this.dataStore.spread.set(0);
      }
      this.midPrice.set(0);
    }
    
    // Max total to scale visual bar correctly
    const maxAskTotal = askEntries.length > 0 ? askEntries[0].total : 0;
    const maxBidTotal = bidEntries.length > 0 ? bidEntries[bidEntries.length - 1].total : 0;
    this.maxTotal.set(Math.max(maxAskTotal, maxBidTotal, 1));
  }

  ngOnDestroy() {
    if (this.ws) {
      this.ws.close();
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
    }
  }
}

