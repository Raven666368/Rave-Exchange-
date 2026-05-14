import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { RiskSentinelState } from '../../core/state/event-schema';

@Component({
  selector: 'app-risk-sentinel',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden font-mono text-[10px]">
      <div class="px-3 py-2 font-bold uppercase tracking-widest border-b flex justify-between items-center shrink-0"
           [ngClass]="{
             'bg-[#131722] text-green-400 border-green-500/30': status() === 'NORMAL',
             'bg-[#1e1a14] text-yellow-400 border-yellow-500/30': status() === 'WARNING',
             'bg-[#2d1b14] text-orange-400 border-orange-500/30': status() === 'DEFENSIVE',
             'bg-[#221010] text-red-500 border-red-500/30': status() === 'SHUTDOWN'
           }">
        <div class="flex items-center gap-2">
          <mat-icon style="font-size: 14px; width: 14px; height: 14px;">security</mat-icon>
          <span>System State: {{ status() }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="toggleConfig()" class="text-gray-400 hover:text-white transition-colors">
            <mat-icon style="font-size: 14px; width: 14px; height: 14px;">settings</mat-icon>
          </button>
          <span class="animate-pulse" [class.text-green-500]="status() === 'NORMAL'" [class.text-red-500]="status() !== 'NORMAL'">●</span>
        </div>
      </div>

      <div class="flex-1 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        @if (showConfig()) {
          <div class="space-y-2 p-2 bg-[#1e222d] rounded border border-[#363c4e]">
            <div class="text-xs font-bold text-gray-300 mb-2">Configure Thresholds</div>
            
            <div class="flex flex-col gap-1">
              <label class="text-gray-500 flex justify-between">Max Drawdown (%) <span>{{ maxDrawdown() }}</span></label>
              <input type="range" min="1" max="10" step="0.5" [ngModel]="maxDrawdown()" (ngModelChange)="maxDrawdown.set($event)" class="w-full accent-red-500" />
            </div>
            
            <div class="flex flex-col gap-1">
              <label class="text-gray-500 flex justify-between">Max Latency (ms) <span>{{ maxLatency() }}</span></label>
              <input type="range" min="50" max="500" step="10" [ngModel]="maxLatency()" (ngModelChange)="maxLatency.set($event)" class="w-full accent-orange-500" />
            </div>
            
            <div class="flex flex-col gap-1">
              <label class="text-gray-500 flex justify-between">Min Coherence <span>{{ minCoherence() | number:'1.2-2' }}</span></label>
              <input type="range" min="0.1" max="1.0" step="0.05" [ngModel]="minCoherence()" (ngModelChange)="minCoherence.set($event)" class="w-full accent-red-500" />
            </div>
            
            <button (click)="toggleConfig()" class="w-full mt-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-400 rounded transition-colors text-center border border-blue-500/30">Done</button>
          </div>
        }

        <!-- Tripwires -->
        <div>
          <div class="text-gray-500 mb-1">TRIPWIRES:</div>
          @if (activeTripwires().length > 0 || hasLocalBreaches()) {
            <div class="space-y-1">
              @for (tw of activeTripwires(); track $index) {
                <div class="flex items-start gap-1">
                  <mat-icon class="text-yellow-500" style="font-size: 12px; width: 12px; height: 12px; margin-top: 1px;">warning</mat-icon>
                  <span [class.text-yellow-400]="tw.level === 'WARNING'"
                        [class.text-orange-400]="tw.level === 'DEFENSIVE'"
                        [class.text-red-400]="tw.level === 'SHUTDOWN'">
                    {{ tw.message }}
                  </span>
                </div>
              }
              
              <!-- Local Threshold Breaches -->
              @if (metrics().drawdown > maxDrawdown()) {
                <div class="flex items-start gap-1 text-red-400">
                  <mat-icon style="font-size: 12px; width: 12px; height: 12px; margin-top: 1px;">error</mat-icon>
                  <span>LOCAL ALARM: Drawdown exceeds {{ maxDrawdown() }}%</span>
                </div>
              }
              @if (metrics().latency > maxLatency()) {
                <div class="flex items-start gap-1 text-orange-400">
                  <mat-icon style="font-size: 12px; width: 12px; height: 12px; margin-top: 1px;">warning</mat-icon>
                  <span>LOCAL ALARM: Latency exceeds {{ maxLatency() }}ms</span>
                </div>
              }
              @if (metrics().strategyCoherence < minCoherence()) {
                <div class="flex items-start gap-1 text-red-500">
                  <mat-icon style="font-size: 12px; width: 12px; height: 12px; margin-top: 1px;">error</mat-icon>
                  <span>LOCAL ALARM: Coherence below {{ minCoherence() | number:'1.2-2' }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="text-green-400/70 italic">None. All systems nominal.</div>
          }
        </div>

        <!-- Automated Actions -->
        <div>
          <div class="text-gray-500 mb-1">AUTOMATED ACTIONS:</div>
          @if (automatedActions().length > 0) {
            <div class="space-y-1">
              @for (action of automatedActions(); track $index) {
                <div class="flex items-center gap-1">
                  <mat-icon class="text-blue-400" style="font-size: 12px; width: 12px; height: 12px;">rule</mat-icon>
                  <span class="text-gray-300">{{ action }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="text-gray-600 italic">No interventions active.</div>
          }
        </div>

        <!-- Metrics Mini-Matrix -->
        <div class="mt-auto grid grid-cols-2 gap-2 pt-2 border-t border-[#1e222d]">
           <div>
             <div class="text-gray-600">DRAWDOWN</div>
             <div class="text-white font-bold" [class.text-red-400]="metrics()?.drawdown && metrics().drawdown > maxDrawdown()">{{ metrics()?.drawdown | number:'1.2-2' }}%</div>
           </div>
           <div>
             <div class="text-gray-600">LATENCY</div>
             <div class="text-white font-bold" [class.text-orange-400]="metrics()?.latency && metrics().latency > maxLatency()">{{ metrics()?.latency }}ms</div>
           </div>
           <div>
             <div class="text-gray-600">SLIP SCORE</div>
             <div class="text-white font-bold" [class.text-yellow-400]="metrics()?.slippageScore && metrics().slippageScore > 0.5">{{ metrics()?.slippageScore | number:'1.2-2' }}</div>
           </div>
           <div>
             <div class="text-gray-600">COHERENCE</div>
             <div class="text-white font-bold" [class.text-red-400]="metrics()?.strategyCoherence && metrics().strategyCoherence < minCoherence()">{{ metrics()?.strategyCoherence | number:'1.2-2' }}</div>
           </div>
        </div>
      </div>
    </div>
  `
})
export class RiskSentinelComponent {
  state = input<RiskSentinelState | null>(null);

  showConfig = signal(false);
  maxDrawdown = signal(3.0);
  maxLatency = signal(200);
  minCoherence = signal(0.6);

  toggleConfig() {
    this.showConfig.update(v => !v);
  }

  hasLocalBreaches() {
    const m = this.metrics();
    return m.drawdown > this.maxDrawdown() || 
           m.latency > this.maxLatency() || 
           m.strategyCoherence < this.minCoherence();
  }

  status() {
    if (this.hasLocalBreaches() && (this.state()?.status === 'NORMAL' || !this.state()?.status)) {
        return 'WARNING';
    }
    return this.state()?.status || 'NORMAL';
  }

  activeTripwires() {
    return this.state()?.activeTripwires || [];
  }

  automatedActions() {
    return this.state()?.automatedActions || [];
  }

  metrics() {
    return this.state()?.metrics || { drawdown: 0, latency: 0, slippageScore: 0, strategyCoherence: 1 };
  }
}
