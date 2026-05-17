import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError, retryWhen, tap, delay } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { App } from './app';

import { DecisionTraceComponent } from './modules/decision-trace/decision-trace.component';
import { StrategyMonitorComponent } from './modules/strategy-monitor/strategy-monitor.component';
import { ExecutionAnalyticsComponent } from './modules/execution-analytics/execution-analytics.component';
import { SystemHealthComponent } from './modules/system-health/system-health.component';
import { RiskSentinelComponent } from './modules/risk-sentinel/risk-sentinel.component';
import { MarketMicrostructureComponent } from './modules/market-microstructure/market-microstructure.component';
import { ActivePositionsComponent } from './modules/active-positions/active-positions.component';
import { CmeGapMonitorComponent } from './modules/cme-gap-monitor/cme-gap-monitor.component';
import { CommandStateService } from './core/state/command-state.service';

interface StreamMessage {
  event: string;
  data: Record<string, unknown>;
}

@Component({
  selector: 'app-command-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule, DecisionTraceComponent, StrategyMonitorComponent, ExecutionAnalyticsComponent, SystemHealthComponent, RiskSentinelComponent, MarketMicrostructureComponent, ActivePositionsComponent, CmeGapMonitorComponent],
  template: `
    <div class="h-full flex flex-col bg-[#050608] text-gray-300 font-mono p-4 border border-[#1e222d] rounded-none xl:rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
      
      <!-- Scanline overlay effect -->
      <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] z-50 opacity-10"></div>

      <!-- Header -->
      <div class="flex items-center justify-between border-b border-[#363c4e] pb-3 mb-4 shrink-0 z-10 bg-[#0b0e14] px-4 -mx-4 -mt-4 pt-4">
        <div class="flex items-center gap-4">
          <div class="relative flex items-center justify-center">
            <mat-icon class="text-cyan-500 animate-pulse drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">memory</mat-icon>
            <div class="absolute inset-0 border border-cyan-500 rounded-full animate-ping opacity-20"></div>
          </div>
          <div>
            <h1 class="text-sm font-bold tracking-[0.25em] text-cyan-500 uppercase">Operational Cognition Visibility</h1>
            <div class="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-3 mt-1">
              <span class="flex items-center gap-1"><div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div> ROUTING: OPTIMAL</span>
              <span class="text-[#363c4e]">|</span>
              <span class="flex items-center gap-1"><div class="w-1.5 h-1.5" [class.bg-green-500]="commandState.wsStatus$() === 'CONNECTED'" [class.bg-yellow-500]="commandState.wsStatus$() !== 'CONNECTED'"></div> STREAM: {{ commandState.wsStatus$() }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2">
            <div class="px-3 py-1 bg-cyan-900/40 border border-cyan-500/30 text-cyan-400 text-[10px] rounded animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.1)]">DATALINK ALIVE</div>
            <button class="px-3 py-1 bg-[#1e222d] hover:bg-[#2a2f3e] border border-[#363c4e] text-gray-400 hover:text-white text-[10px] rounded transition" (click)="reconnectWs()">FLUSH TCP</button>
        </div>
      </div>

      <!-- Main Terminal Grid -->
      <div class="grid grid-cols-12 gap-4 flex-1 min-h-0 z-10">
        
        <!-- Column 1: System & Execution Core (Left) -->
        <div class="col-span-12 lg:col-span-3 flex flex-col gap-4">
           <!-- System Health Array -->
           <div class="flex-1">
             <app-system-health [healthState]="commandState.systemHealth$()"></app-system-health>
           </div>
           
           <!-- Liquidity Radar -->
           <div class="flex-1">
             <app-market-microstructure [data]="commandState.marketMicrostructure$()"></app-market-microstructure>
           </div>

           <!-- CME Gaps -->
           <div class="flex-1">
             <app-cme-gap-monitor></app-cme-gap-monitor>
           </div>
        </div>

        <!-- Column 2: The Reasoning Engine (Middle Wide) -->
        <div class="col-span-12 lg:col-span-5 flex flex-col gap-4 border border-[#1e222d] bg-[#0b0e14] rounded-lg overflow-hidden relative">
           <!-- Grid backdrop -->
           <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style="background-image: linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, 1) 25%, rgba(255, 255, 255, 1) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 1) 75%, rgba(255, 255, 255, 1) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, 1) 25%, rgba(255, 255, 255, 1) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 1) 75%, rgba(255, 255, 255, 1) 76%, transparent 77%, transparent); background-size: 50px 50px;"></div>
           
           <div class="flex-1 overflow-hidden p-2 z-10 flex flex-col gap-2">
              <div class="h-1/2 border border-[#1e222d] bg-[#050608]/50 overflow-hidden rounded">
                <app-decision-trace [traces]="commandState.decisionTrace$()"></app-decision-trace>
              </div>
              <div class="h-1/4 border border-[#1e222d] bg-[#050608]/50 overflow-hidden rounded">
                 <app-execution-analytics [executions]="commandState.executionAnalytics$()"></app-execution-analytics>
              </div>
              <div class="h-1/4 border border-[#1e222d] bg-[#050608]/50 overflow-hidden rounded flex flex-col">
                 <!-- Live Signals / Redis Stream Minimal View -->
                 <div class="bg-[#1e222d] px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between h-[30px] items-center shrink-0">
                    <span>Timeline Event Bus</span>
                    <mat-icon class="text-green-500 scale-75 animate-pulse">timeline</mat-icon>
                 </div>
                 <div class="flex-1 overflow-y-auto p-2 text-[9px] custom-scrollbar">
                    @for (item of commandState.eventTimeline$(); track item.id) {
                      <div class="flex gap-4 py-1.5 border-b border-[#1e222d] last:border-0 hover:bg-white/5 transition-colors text-gray-400 items-center">
                        <span class="text-blue-400 min-w-[50px]">{{ item.timestamp | date:'HH:mm:ss' }}</span>
                        <span class="text-gray-300 font-bold min-w-[60px]" 
                              [class.text-green-400]="item.type === 'TRACE' || item.type === 'EXECUTION'"
                              [class.text-purple-400]="item.type === 'STRATEGY'">
                          [{{ item.type }}]
                        </span>
                        <span class="truncate">{{ item.message }}</span>
                      </div>
                    } @empty {
                      <div class="text-gray-600 italic mt-2">Listening to chronological event mesh...</div>
                    }
                 </div>
              </div>
           </div>
        </div>

        <!-- Column 3: Strategy Contribution (Right) -->
        <div class="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <div class="flex-1 overflow-hidden">
             <app-active-positions></app-active-positions>
          </div>
          <div class="flex-1 overflow-hidden shrink-0">
            <app-risk-sentinel [state]="commandState.riskSentinel$()"></app-risk-sentinel>
          </div>
          <div class="flex-1 overflow-hidden">
            <app-strategy-monitor [strategies]="commandState.strategyWeights$()"></app-strategy-monitor>
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
      background: rgba(0,0,0,0.1);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #363c4e;
    }
  `]
})
export class CommandDashboardComponent implements OnInit, OnDestroy {
  commandState = inject(CommandStateService);
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
    // Clear raw states? Handled automatically or let state flow.
    this.connectWs();
  }

  private connectWs() {
    this.commandState.setWsStatus('CONNECTING');
    
    // Use window.location.host and the proxy path
    const isBrowser = typeof window !== 'undefined';
    const wsProto = isBrowser && window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = isBrowser ? `${wsProto}${window.location.host}/ws/bot/ws` : `ws://localhost:8080/ws`;
    
    this.wsSubject$ = webSocket({
      url: wsUrl,
      openObserver: {
        next: () => {
          this.commandState.setWsStatus('CONNECTED');
          this.app.addLog('Execution Telemetry Linked.', 'success');
        }
      },
      closeObserver: {
        next: () => {
          this.commandState.setWsStatus('DISCONNECTED');
        }
      }
    });

    this.wsSubject$.pipe(
      tap((msg: StreamMessage) => {
        if (msg && msg.event) {
           this.commandState.processEvent(msg.event, msg.data || msg);
        }
      }),
      retryWhen(errors => errors.pipe(
        tap(() => this.commandState.setWsStatus('DISCONNECTED')),
        delay(3000)
      )),
      catchError(() => EMPTY)
    ).subscribe();
  }
}

