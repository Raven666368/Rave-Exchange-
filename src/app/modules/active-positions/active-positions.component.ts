import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface OpenPosition {
  symbol: string;
  side: 'BUY' | 'SELL';
  size: number;
  entryPrice: number;
  markPrice: number;
  pnlAbs: number;
  pnlPct: number;
}

@Component({
  selector: 'app-active-positions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden">
      <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between items-center">
        <span>Active Exposures</span>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 custom-scrollbar font-mono text-[10px] space-y-3">
        @if (positions().length > 0) {
          @for (pos of positions(); track pos.symbol) {
             <div class="bg-[#1e222d] p-2 rounded border border-[#2a2e39]">
                <div class="flex justify-between items-center mb-1">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-gray-200">{{ pos.symbol }}</span>
                    <span class="px-1 rounded text-[9px] font-bold"
                          [class.bg-green-900]="pos.side === 'BUY'"
                          [class.text-green-400]="pos.side === 'BUY'"
                          [class.bg-red-900]="pos.side === 'SELL'"
                          [class.text-red-400]="pos.side === 'SELL'">
                      {{ pos.side }}
                    </span>
                  </div>
                  <div class="text-right flex flex-col items-end">
                    <span class="font-bold" [class.text-green-400]="pos.pnlAbs >= 0" [class.text-red-400]="pos.pnlAbs < 0">
                      {{ pos.pnlAbs >= 0 ? '+' : '' }}{{ pos.pnlAbs | number:'1.2-2' }} USDT
                    </span>
                    <span [class.text-green-500]="pos.pnlPct >= 0" [class.text-red-500]="pos.pnlPct < 0">
                      {{ pos.pnlPct >= 0 ? '+' : '' }}{{ pos.pnlPct | number:'1.2-2' }}%
                    </span>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-gray-500 mt-2">
                  <div>Size: <span class="text-gray-300">{{ pos.size }}</span></div>
                  <div>Entry: <span class="text-white">{{ pos.entryPrice | number:'1.2-4' }}</span></div>
                  <div>Mark: <span class="text-white animate-pulse">{{ pos.markPrice | number:'1.2-4' }}</span></div>
                </div>
             </div>
          }
        } @else {
          <div class="text-gray-600 italic">No capital allocated.</div>
        }
      </div>
    </div>
  `
})
export class ActivePositionsComponent {
  positions = input<OpenPosition[]>([
    { symbol: 'BTCUSDT', side: 'BUY', size: 0.1, entryPrice: 62450.5, markPrice: 62510.0, pnlAbs: 5.95, pnlPct: 0.09 },
    { symbol: 'SOLUSDT', side: 'SELL', size: 10, entryPrice: 145.20, markPrice: 146.10, pnlAbs: -9.00, pnlPct: -0.62 }
  ]);
}
