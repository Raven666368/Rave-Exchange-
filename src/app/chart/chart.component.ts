import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  PLATFORM_ID,
  input,
  effect,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, ColorType, CandlestickSeries, LineSeries, IPriceLine } from 'lightweight-charts';

@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full h-full relative flex flex-col bg-[#131722] rounded-xl overflow-hidden border border-[#363c4e]">
      @if (isLoading()) {
        <div class="absolute inset-0 flex items-center justify-center bg-[#131722]/80 z-10 backdrop-blur-sm">
          <div class="flex flex-col items-center gap-3">
            <svg class="animate-spin h-8 w-8 text-[#089981]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-xs text-gray-400 font-mono uppercase tracking-widest">Loading Chart Data...</span>
          </div>
        </div>
      }
      <div #chartContainer class="flex-1 w-full relative"></div>
      <div #rsiContainer class="h-[120px] w-full relative border-t border-[#363c4e]"></div>
    </div>
  `,
  imports: [],
})
export class ChartComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('rsiContainer', { static: true }) rsiContainer!: ElementRef<HTMLDivElement>;
  
  symbol = input<string>('BTCUSDT');
  
  private chart: IChartApi | null = null;
  private candlestickSeries: ISeriesApi<'Candlestick'> | null = null;
  private sma20Series: ISeriesApi<'Line'> | null = null;
  private sma50Series: ISeriesApi<'Line'> | null = null;
  private rsiChart: IChartApi | null = null;
  private rsiSeries: ISeriesApi<'Line'> | null = null;
  private ws: WebSocket | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastBarTime = 0;
  
  private bidLine: IPriceLine | null = null;
  private askLine: IPriceLine | null = null;
  
  private historicalData: CandlestickData[] = [];
  
  isLoading = signal<boolean>(true);

  constructor() {
    effect(() => {
      const sym = this.symbol();
      if (this.isBrowser && this.chart) {
        this.fetchHistoricalData(sym);
        // Restart websocket to subscribe to new symbol
        if (this.ws) {
           this.ws.close();
        }
      }
    });
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.initChart();
      this.fetchHistoricalData(this.symbol());
    }
  }
  
  private initChart() {
    this.chart = createChart(this.chartContainer.nativeElement, {
      width: this.chartContainer.nativeElement.clientWidth,
      height: this.chartContainer.nativeElement.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Normal crosshair
      },
    });

    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#089981',
      wickDownColor: '#f23645',
    });

    this.sma20Series = this.chart.addSeries(LineSeries, {
      color: '#2962FF',
      lineWidth: 2,
    });

    this.sma50Series = this.chart.addSeries(LineSeries, {
      color: '#FF6D00',
      lineWidth: 2,
    });

    this.rsiChart = createChart(this.rsiContainer.nativeElement, {
      width: this.rsiContainer.nativeElement.clientWidth,
      height: this.rsiContainer.nativeElement.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#d1d4dc',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
    });

    this.rsiSeries = this.rsiChart.addSeries(LineSeries, {
      color: '#b3e5fc',
      lineWidth: 2,
    });
    
    this.rsiSeries.createPriceLine({ price: 70, color: 'rgba(242, 54, 69, 0.5)', lineStyle: 2, axisLabelVisible: true, title: '' });
    this.rsiSeries.createPriceLine({ price: 30, color: 'rgba(8, 153, 129, 0.5)', lineStyle: 2, axisLabelVisible: true, title: '' });

    // sync timescales
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range !== null) {
        this.rsiChart?.timeScale().setVisibleLogicalRange(range);
      }
    });

    this.rsiChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range !== null) {
        this.chart?.timeScale().setVisibleLogicalRange(range);
      }
    });

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this.chartContainer.nativeElement) {
          this.chart?.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
        } else if (entry.target === this.rsiContainer.nativeElement) {
          this.rsiChart?.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height });
        }
      }
    });

    this.resizeObserver.observe(this.chartContainer.nativeElement);
    this.resizeObserver.observe(this.rsiContainer.nativeElement);
  }

  private calculateSMA(data: CandlestickData[], period: number): { time: Time, value: number }[] {
    const smaData: { time: Time, value: number }[] = [];
    if (data.length < period) return smaData;
    
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i].close;
    }
    smaData.push({ time: data[period - 1].time, value: sum / period });

    for (let i = period; i < data.length; i++) {
        sum = sum - data[i - period].close + data[i].close;
        smaData.push({ time: data[i].time, value: sum / period });
    }
    return smaData;
  }

  private calculateRSI(data: CandlestickData[], period = 14): { time: Time, value: number }[] {
    let gains = 0;
    let losses = 0;
    const rsiData: { time: Time, value: number }[] = [];

    if (data.length < period + 1) return rsiData;

    for (let i = 1; i <= period; i++) {
      const diff = data[i].close - data[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    const firstRsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    rsiData.push({ time: data[period].time, value: firstRsi });

    for (let i = period + 1; i < data.length; i++) {
      const diff = data[i].close - data[i - 1].close;
      let gain = 0;
      let loss = 0;
      if (diff >= 0) gain = diff;
      else loss = -diff;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      const rs = avgGain / avgLoss;
      const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
      rsiData.push({ time: data[i].time, value: rsi });
    }

    return rsiData;
  }

  private async fetchHistoricalData(symbol: string) {
    this.isLoading.set(true);
    try {
      const res = await fetch(`/api/historical/${symbol}?interval=1&limit=200`);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to fetch historical data', errorText);
        throw new Error(`HTTP error: ${res.status}, body: ${errorText}`);
      }

      const text = await res.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON response:', e);
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
      
      if (payload.retCode === 0 && payload.result && payload.result.list) {
        // Bybit returns newest first, so we reverse it
        const list = payload.result.list.reverse();
        const data: CandlestickData[] = list.map((item: string[]) => {
          return {
            time: (parseInt(item[0]) / 1000) as Time,
            open: parseFloat(item[1]),
            high: parseFloat(item[2]),
            low: parseFloat(item[3]),
            close: parseFloat(item[4]),
          };
        });
        
        if (this.chart && this.candlestickSeries && data.length > 0) {
          this.historicalData = data;
          const lastCandle = data[data.length - 1];
          this.lastBarTime = lastCandle.time as number;
          this.candlestickSeries.setData(data);
          
          if (this.sma20Series) this.sma20Series.setData(this.calculateSMA(data, 20));
          if (this.sma50Series) this.sma50Series.setData(this.calculateSMA(data, 50));
          
          if (this.rsiSeries) {
            const rsiData = this.calculateRSI(data);
            this.rsiSeries.setData(rsiData);
          }
          
          // Clear old bid/ask lines if symbol changed so they don't jump weirdly
          if (this.bidLine) {
            this.candlestickSeries.removePriceLine(this.bidLine);
            this.bidLine = null;
          }
          if (this.askLine) {
            this.candlestickSeries.removePriceLine(this.askLine);
            this.askLine = null;
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch historical data', e);
    } finally {
      this.isLoading.set(false);
      this.connectWs(symbol);
    }
  }

  private connectWs(symbol: string) {
    if (!this.isBrowser) return;

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect loop from old socket
      this.ws.close();
      this.ws = null;
    }
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.pongTimeout) clearTimeout(this.pongTimeout);

    const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      ws.send(JSON.stringify({
        op: 'subscribe',
        args: [`kline.1.${symbol}`, `orderbook.1.${symbol}`]
      }));

      this.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ op: 'ping' }));
          this.pongTimeout = setTimeout(() => {
            console.warn('WS ping timeout, reconnecting...');
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
            this.pongTimeout = null;
          }
          return;
        }
        if (msg.topic === `kline.1.${symbol}` && msg.data && msg.data.length > 0) {
          const kline = msg.data[0];
          if (this.chart && this.candlestickSeries) {
            const timeSeconds = parseInt(kline.start) / 1000;
            if (timeSeconds < this.lastBarTime) {
              return; // Ignore older updates from the websocket
            }
            this.lastBarTime = timeSeconds;
            
            const candle: CandlestickData = {
              time: timeSeconds as Time,
              open: parseFloat(kline.open),
              high: parseFloat(kline.high),
              low: parseFloat(kline.low),
              close: parseFloat(kline.close),
            };
            
            this.candlestickSeries.update(candle);
            
            // update historical data array
            if (this.historicalData.length > 0) {
              const lastHistorical = this.historicalData[this.historicalData.length - 1];
              if (timeSeconds === (lastHistorical.time as number)) {
                 this.historicalData[this.historicalData.length - 1] = candle;
              } else if (timeSeconds > (lastHistorical.time as number)) {
                 this.historicalData.push(candle);
                 if (this.historicalData.length > 250) this.historicalData.shift();
              }
            } else {
              this.historicalData.push(candle);
            }
            
            if (this.sma20Series && this.historicalData.length >= 20) {
              const sma20 = this.calculateSMA(this.historicalData, 20);
              if (sma20.length > 0) this.sma20Series.update(sma20[sma20.length - 1]);
            }
            if (this.sma50Series && this.historicalData.length >= 50) {
              const sma50 = this.calculateSMA(this.historicalData, 50);
              if (sma50.length > 0) this.sma50Series.update(sma50[sma50.length - 1]);
            }
            
            if (this.rsiSeries && this.historicalData.length > 0) {
              const rsiData = this.calculateRSI(this.historicalData);
              if (rsiData.length > 0) {
                this.rsiSeries.update(rsiData[rsiData.length - 1]);
              }
            }
          }
        }
        
        // Handle orderbook
        if (msg.topic === `orderbook.1.${symbol}` && msg.data) {
          if (msg.data.b && msg.data.b.length > 0 && msg.data.a && msg.data.a.length > 0) {
            const bestBid = parseFloat(msg.data.b[0][0]);
            const bestAsk = parseFloat(msg.data.a[0][0]);
            
            if (this.candlestickSeries) {
              if (!this.bidLine) {
                this.bidLine = this.candlestickSeries.createPriceLine({
                  price: bestBid,
                  color: '#089981',
                  lineWidth: 1,
                  lineStyle: 2,
                  axisLabelVisible: true,
                  title: 'Bid',
                });
              } else {
                this.bidLine.applyOptions({ price: bestBid });
              }
              
              if (!this.askLine) {
                this.askLine = this.candlestickSeries.createPriceLine({
                  price: bestAsk,
                  color: '#f23645',
                  lineWidth: 1,
                  lineStyle: 2,
                  axisLabelVisible: true,
                  title: 'Ask',
                });
              } else {
                this.askLine.applyOptions({ price: bestAsk });
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes("Cannot update oldest data")) {
          // This happens when lightweight-charts gets slightly unordered timestamps from the WebSocket feed. We log as debug and ignore.
          console.debug("Ignored older timestamp from ws", err.message);
        } else {
          console.error('WS err or parse error', err);
        }
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.pongTimeout) clearTimeout(this.pongTimeout);
      // Reconnect after 5 seconds if disposed not called (which sets wait to timeout, handled by effect generally)
      setTimeout(() => { if (this.chart) this.connectWs(symbol); }, 5000);
    };
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.candlestickSeries = null;
    }
    if (this.rsiChart) {
      this.rsiChart.remove();
      this.rsiChart = null;
      this.rsiSeries = null;
    }
  }
}
