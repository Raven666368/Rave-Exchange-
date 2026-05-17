import {ChangeDetectionStrategy, Component, input, computed} from '@angular/core';
import {DecimalPipe, DatePipe} from '@angular/common';
import {OrderHistoryEntry} from './app';

@Component({
  selector: 'app-executed-trades',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  template: `
    <div class="bg-[#1e222d] rounded-xl p-5 border border-[#363c4e] shadow-lg flex-1 overflow-hidden flex flex-col h-[300px]">
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#363c4e]">
        <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Executed Trades</h2>
      </div>
      
      <div class="flex-1 overflow-y-auto custom-scrollbar">
        <table class="w-full text-left font-mono text-[10px]">
          <thead class="text-gray-500 sticky top-0 bg-[#1e222d] mb-2 uppercase">
            <tr>
              <th class="py-2">Time</th>
              <th class="py-2">Symbol</th>
              <th class="py-2 text-center">Type</th>
              <th class="py-2 text-right">Price</th>
              <th class="py-2 text-right">Size</th>
              <th class="py-2 text-right">P&L</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#363c4e]">
            @for (entry of executedHistory(); track entry.id) {
              <tr class="hover:bg-white/5 transition-colors cursor-pointer">
                <td class="py-2 text-gray-400">{{ entry.timestamp | date:'HH:mm:ss' }}</td>
                <td class="py-2 text-gray-300">{{ entry.symbol }}</td>
                <td class="py-2 text-center">
                  <span [class]="entry.type === 'BUY' ? 'text-[#089981] font-bold' : 'text-[#f23645] font-bold'">
                    {{ entry.type }}
                  </span>
                </td>
                <td class="py-2 text-right text-gray-200">{{ (entry.price || 0) | number:'1.2-2' }}</td>
                <td class="py-2 text-right text-gray-200">{{ (entry.size || 0) | number:'1.2-4' }}</td>
                <td class="py-2 text-right">
                  @let pnl = calculatePnl(entry);
                  @if (symbolPrices().has(entry.symbol)) {
                    <div class="flex flex-col items-end">
                      <span [class]="pnl.absolute >= 0 ? 'text-[#00ff88]' : 'text-[#ff2244]'">
                        {{ pnl.absolute >= 0 ? '+' : '' }}{{ pnl.absolute | number:'1.2-2' }}
                      </span>
                      <span [class]="pnl.percent >= 0 ? 'text-[#00ff88]' : 'text-[#ff2244]'">
                        {{ pnl.percent >= 0 ? '+' : '' }}{{ pnl.percent | number:'1.2-2' }}%
                      </span>
                    </div>
                  } @else {
                    <span class="text-gray-500">-</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutedTradesComponent {
  history = input.required<OrderHistoryEntry[]>();
  symbolPrices = input<Map<string, number>>(new Map());
  executedHistory = computed(() => this.history().filter(h => h.status === 'FILLED'));

  calculatePnl(pos: OrderHistoryEntry) {
    const currentPrice = this.symbolPrices().get(pos.symbol);
    if (!currentPrice) {
      return { absolute: 0, percent: 0 };
    }

    const priceDiff = currentPrice - pos.price;
    const absolute = pos.type === 'BUY' ? priceDiff * pos.size : -priceDiff * pos.size;
    const percent = (Math.abs(priceDiff) / pos.price) * (pos.leverage || 1) * (priceDiff >= 0 ? 1 : -1) * 100;

    return { absolute, percent };
  }
}
