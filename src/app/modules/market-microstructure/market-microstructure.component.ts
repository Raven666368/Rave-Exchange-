import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MarketMicrostructureState } from '../../core/state/event-schema';

@Component({
  selector: 'app-market-microstructure',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden font-mono text-[10px]">
      <div class="px-3 py-2 font-bold uppercase tracking-widest border-b bg-[#131722] text-teal-400 border-teal-500/30 flex justify-between items-center shrink-0">
        <div class="flex items-center gap-2">
          <mat-icon style="font-size: 14px; width: 14px; height: 14px;">radar</mat-icon>
          <span>Liquidity Radar</span>
        </div>
        <span class="animate-pulse text-teal-500">●</span>
      </div>

      <div class="flex-1 p-2 overflow-y-auto custom-scrollbar flex flex-col gap-2">
        @if (hasData()) {
            @for (symbol of objectKeys(data()); track symbol) {
              <div class="bg-[#1e222d] rounded p-2 flex flex-col gap-2 border border-[#2a2e39]">
                <div class="flex justify-between items-center border-b border-[#2a2e39] pb-1">
                  <span class="font-bold text-gray-200">{{ symbol }}</span>
                  @if (data()[symbol].sweep_detected) {
                    <span class="text-orange-400 font-bold bg-orange-900/30 px-1 rounded flex items-center gap-1">
                      <mat-icon style="font-size: 10px; width: 10px; height: 10px;">warning</mat-icon> SWEEP
                    </span>
                  } @else {
                     <span class="text-green-500/50">STABLE</span>
                  }
                </div>
                
                <div class="grid grid-cols-2 gap-2 text-right">
                  <div class="flex justify-between">
                    <span class="text-gray-500">SPREAD:</span>
                    <span class="text-gray-300 font-bold" [class.text-red-400]="data()[symbol].spread > 10">{{ data()[symbol].spread | number:'1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">IMBALANCE:</span>
                    <span class="text-gray-300 font-bold" 
                          [class.text-green-400]="data()[symbol].imbalance > 1.2"
                          [class.text-red-400]="data()[symbol].imbalance < 0.8">
                      {{ data()[symbol].imbalance | number:'1.2-2' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">BID:</span>
                    <span class="text-green-400">{{ data()[symbol].best_bid | number:'1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">ASK:</span>
                    <span class="text-red-400">{{ data()[symbol].best_ask | number:'1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between col-span-2">
                    <span class="text-gray-500">EXCH DIVERGENCE:</span>
                    <span class="text-gray-300 font-bold" [class.text-red-400]="data()[symbol].exchange_divergence > 5">
                      {{ data()[symbol].exchange_divergence | number:'1.2-2' }} bps
                    </span>
                  </div>
                  @if (data()[symbol].depth_collapse) {
                    <div class="flex justify-between col-span-2 text-red-500 bg-red-900/20 px-1 rounded animate-pulse items-center">
                       <span class="font-bold flex items-center gap-1"><mat-icon style="font-size: 12px; width: 12px; height: 12px;">warning</mat-icon> DEPTH COLLAPSE DETECTED</span>
                    </div>
                  }
                   <div class="col-span-2 mt-1">
                      <div class="w-full bg-gray-800 rounded-full h-1.5 flex overflow-hidden">
                         <div class="bg-green-500 h-1.5" [style.width.%]="(data()[symbol].imbalance / (1 + data()[symbol].imbalance)) * 100"></div>
                         <div class="bg-red-500 h-1.5 flex-1"></div>
                      </div>
                   </div>
                </div>
              </div>
            }
        } @else {
           <div class="flex h-full items-center justify-center text-gray-500 italic">
              Awaiting Microstructure Telemetry...
           </div>
        }
      </div>
    </div>
  `
})
export class MarketMicrostructureComponent {
  data = input<Record<string, MarketMicrostructureState>>({});

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  hasData(): boolean {
    return this.objectKeys(this.data()).length > 0;
  }
}
