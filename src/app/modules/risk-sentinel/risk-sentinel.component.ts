import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RiskSentinelState } from '../../core/state/event-schema';

@Component({
  selector: 'app-risk-sentinel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
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
        <span class="animate-pulse" [class.text-green-500]="status() === 'NORMAL'" [class.text-red-500]="status() !== 'NORMAL'">●</span>
      </div>

      <div class="flex-1 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
        <!-- Tripwires -->
        <div>
          <div class="text-gray-500 mb-1">TRIPWIRES:</div>
          @if (activeTripwires().length > 0) {
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
             <div class="text-white font-bold" [class.text-red-400]="metrics()?.drawdown && metrics().drawdown > 3">{{ metrics()?.drawdown | number:'1.2-2' }}%</div>
           </div>
           <div>
             <div class="text-gray-600">LATENCY</div>
             <div class="text-white font-bold" [class.text-orange-400]="metrics()?.latency && metrics().latency > 200">{{ metrics()?.latency }}ms</div>
           </div>
           <div>
             <div class="text-gray-600">SLIP SCORE</div>
             <div class="text-white font-bold" [class.text-yellow-400]="metrics()?.slippageScore && metrics().slippageScore > 0.5">{{ metrics()?.slippageScore | number:'1.2-2' }}</div>
           </div>
           <div>
             <div class="text-gray-600">COHERENCE</div>
             <div class="text-white font-bold" [class.text-red-400]="metrics()?.strategyCoherence && metrics().strategyCoherence < 0.6">{{ metrics()?.strategyCoherence | number:'1.2-2' }}</div>
           </div>
        </div>
      </div>
    </div>
  `
})
export class RiskSentinelComponent {
  state = input<RiskSentinelState | null>(null);

  status() {
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
