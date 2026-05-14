import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CMEGap {
  symbol: string;
  direction: 'UP' | 'DOWN';
  size: number;
  proximityScore: number;
  top: number;
  bottom: number;
}

@Component({
  selector: 'app-cme-gap-monitor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden">
      <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between items-center">
        <span>CME Futures Gap Map</span>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 custom-scrollbar font-mono text-[10px] space-y-3">
        @if (gaps().length > 0) {
          @for (gap of gaps(); track $index) {
             <div class="bg-[#1e222d] p-2 rounded border border-[#2a2e39]">
                <div class="flex justify-between items-center mb-2">
                  <span class="font-bold text-gray-300">{{ gap.symbol }}</span>
                  <span [class.text-green-400]="gap.direction === 'UP'" [class.text-red-400]="gap.direction === 'DOWN'" class="font-bold">
                    {{ gap.direction }} GAP
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-gray-500">
                  <div>Top: <span class="text-white">{{ gap.top | number:'1.2-2' }}</span></div>
                  <div>Bot: <span class="text-white">{{ gap.bottom | number:'1.2-2' }}</span></div>
                  <div>Size: <span class="text-white">{{ gap.size | number:'1.4-4' }}%</span></div>
                  <div>Prox: 
                    <span [class.text-orange-400]="gap.proximityScore > 80"
                          [class.text-yellow-400]="gap.proximityScore > 50 && gap.proximityScore <= 80"
                          [class.text-blue-400]="gap.proximityScore <= 50">
                      {{ gap.proximityScore | number:'1.1-1' }}
                    </span>
                  </div>
                </div>
                <div class="w-full h-1.5 bg-gray-800 rounded mt-2 overflow-hidden">
                   <div class="h-full" 
                        [class.bg-orange-500]="gap.proximityScore > 80"
                        [class.bg-yellow-500]="gap.proximityScore > 50 && gap.proximityScore <= 80"
                        [class.bg-blue-500]="gap.proximityScore <= 50"
                        [style.width.%]="gap.proximityScore"></div>
                </div>
             </div>
          }
        } @else {
          <div class="text-gray-600 italic">No structural gaps detected.</div>
        }
      </div>
    </div>
  `
})
export class CmeGapMonitorComponent {
  gaps = input<CMEGap[]>([
    { symbol: 'BTC1!', direction: 'UP', size: 1.25, proximityScore: 85.5, top: 62500, bottom: 61850 },
    { symbol: 'BTC1!', direction: 'DOWN', size: 0.8, proximityScore: 42.0, top: 59000, bottom: 58500 }
  ]);
}
