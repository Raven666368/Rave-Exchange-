import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError, retryWhen, tap, delay } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { App } from './app';

interface StreamMessage {
  event: string;
  data: {
    symbol?: string;
    status?: string;
    side?: string;
    position_id?: string;
    pnl?: number;
    [key: string]: unknown;
  };
}

@Component({
  selector: 'app-command-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] text-gray-300 font-mono p-4 rounded-xl border border-[#1e222d] shadow-2xl relative overflow-hidden">
      
      <!-- Scanline overlay effect -->
      <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-50 opacity-20"></div>

      <!-- Header -->
      <div class="flex items-center justify-between border-b border-[#1e222d] pb-3 mb-4 shrink-0 z-10">
        <div class="flex items-center gap-3">
          <mat-icon class="text-red-500 animate-pulse">radar</mat-icon>
          <div>
            <h1 class="text-lg font-bold tracking-widest text-red-500 uppercase drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]">Godmode v1 Command Center</h1>
            <div class="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <span>Status:</span>
              <span [class]="wsStatus() === 'CONNECTED' ? 'text-green-500' : 'text-yellow-500'">{{ wsStatus() }}</span>
              <span class="text-[#363c4e]">|</span>
              <span>Worker Fleet: <span class="text-cyan-400">ONLINE</span></span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
            <div class="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-500 text-[10px] rounded animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.2)]">DEFCON 2</div>
            <button class="px-3 py-1 bg-[#1e222d] hover:bg-[#2a2f3e] border border-[#363c4e] text-[10px] rounded transition" (click)="reconnectWs()">REBOOT LINK</button>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="grid grid-cols-12 gap-4 flex-1 overflow-hidden z-10">
        
        <!-- Live Redis Stream: Orders -->
        <div class="col-span-12 lg:col-span-4 flex flex-col bg-[#131722] border border-[#1e222d] rounded-lg overflow-hidden">
          <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between">
            <span>[Stream] Orders</span>
            <span class="text-xs">{{ streamData.orders().length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
            @for (item of streamData.orders(); track $index) {
              <div class="bg-[#0b0e14] p-2 border-l-2 border-blue-500 text-[10px]">
                <div class="flex justify-between text-blue-400 mb-1">
                  <span>{{ item?.data?.symbol || 'UNKNOWN' }}</span>
                  <span>{{ item?.data?.status || 'PENDING' }}</span>
                </div>
                <div class="text-gray-500 break-all">{{ item | json }}</div>
              </div>
            } @empty {
              <div class="h-full flex items-center justify-center text-gray-600 text-[10px] uppercase">Awaiting signals...</div>
            }
          </div>
        </div>

        <!-- Live Redis Stream: Positions -->
        <div class="col-span-12 lg:col-span-4 flex flex-col bg-[#131722] border border-[#1e222d] rounded-lg overflow-hidden">
          <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between">
            <span>[Stream] Positions</span>
            <span class="text-xs">{{ streamData.positions().length }}</span>
          </div>
          <div class="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
            @for (item of streamData.positions(); track $index) {
              <div class="bg-[#0b0e14] p-2 border-l-2 border-purple-500 text-[10px]">
                <div class="flex justify-between text-purple-400 mb-1">
                  <span>{{ item?.data?.symbol || 'UNKNOWN' }}</span>
                  <span class="uppercase">{{ item?.data?.side || 'POSITION' }}</span>
                </div>
                <div class="text-gray-500 break-all">{{ item | json }}</div>
              </div>
            } @empty {
              <div class="h-full flex items-center justify-center text-gray-600 text-[10px] uppercase">No active positions...</div>
            }
          </div>
        </div>

        <!-- Live Redis Stream: PNL & Strategy Signals -->
        <div class="col-span-12 lg:col-span-4 flex flex-col bg-[#131722] border border-[#1e222d] rounded-lg overflow-hidden">
          <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between items-center">
            <span>[Stream] PnL & Signals</span>
            <div class="flex gap-1">
               <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" style="animation-delay: 200ms"></span>
            </div>
          </div>
          <div class="flex-1 overflow-y-auto p-2 custom-scrollbar space-y-2">
            @for (item of streamData.pnl(); track $index) {
              <div class="bg-[#0b0e14] p-2 border-l-2" [class.border-green-500]="(item?.data?.pnl || 0) > 0" [class.border-red-500]="(item?.data?.pnl || 0) <= 0" class="text-[10px]">
                <div class="flex justify-between mb-1" [class.text-green-400]="(item?.data?.pnl || 0) > 0" [class.text-red-400]="(item?.data?.pnl || 0) <= 0">
                  <span>{{ item?.data?.position_id || 'ID_N/A' }}</span>
                  <span>{{ (item?.data?.pnl || 0) > 0 ? '+' : ''}}{{ item?.data?.pnl || 0 }} USDT</span>
                </div>
                <div class="text-gray-500 break-all">{{ item | json }}</div>
              </div>
            } @empty {
              <div class="h-full flex items-center justify-center text-gray-600 text-[10px] uppercase">Monitoring telemetry...</div>
            }
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.2);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #363c4e;
    }
  `]
})
export class CommandDashboardComponent implements OnInit, OnDestroy {
  wsStatus = signal<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  
  streamData = {
    orders: signal<StreamMessage[]>([]),
    positions: signal<StreamMessage[]>([]),
    pnl: signal<StreamMessage[]>([])
  };

  private wsSubject$?: WebSocketSubject<StreamMessage>;
  private app = inject(App);

  ngOnInit() {
    this.connectWs();
  }

  ngOnDestroy() {
    if (this.wsSubject$) {
      this.wsSubject$.complete();
    }
  }

  reconnectWs() {
    if (this.wsSubject$) {
      this.wsSubject$.complete();
    }
    this.streamData.orders.set([]);
    this.streamData.positions.set([]);
    this.streamData.pnl.set([]);
    this.connectWs();
  }

  private connectWs() {
    this.wsStatus.set('CONNECTING');
    
    // Use window.location.host and the proxy path
    const isBrowser = typeof window !== 'undefined';
    const wsProto = isBrowser && window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = isBrowser ? `${wsProto}${window.location.host}/ws/bot/ws` : `ws://localhost:8080/ws`;
    
    this.wsSubject$ = webSocket({
      url: wsUrl,
      openObserver: {
        next: () => {
          this.wsStatus.set('CONNECTED');
          this.app.addLog('Military Command WS Link Established (Redis Streams)', 'success');
        }
      },
      closeObserver: {
        next: () => {
          this.wsStatus.set('DISCONNECTED');
        }
      }
    });

    this.wsSubject$.pipe(
      tap((msg: StreamMessage) => {
        if (msg && msg.event) {
          switch (msg.event) {
            case 'order_update':
              this.streamData.orders.update(orders => [msg, ...orders].slice(0, 50));
              break;
            case 'position_update':
              this.streamData.positions.update(pos => [msg, ...pos].slice(0, 50));
              break;
            case 'pnl_update':
              this.streamData.pnl.update(pnl => [msg, ...pnl].slice(0, 50));
              break;
            default:
              // Perhaps strategy signals!
              this.streamData.orders.update(orders => [msg, ...orders].slice(0, 50));
              break;
          }
        }
      }),
      retryWhen(errors => errors.pipe(
        tap(() => this.wsStatus.set('DISCONNECTED')),
        delay(3000)
      )),
      catchError(() => EMPTY)
    ).subscribe();
  }
}
