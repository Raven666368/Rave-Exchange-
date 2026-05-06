import { Component, input } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { OrderHistoryEntry } from './app';

@Component({
  selector: 'app-pnl-display',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="bg-canvas border border-line rounded-xl p-5 shadow-lg font-mono">
      <h2 class="text-[10px] font-bold text-dim uppercase tracking-widest mb-4">Open Positions</h2>
      <div class="space-y-3">
        @for (pos of positions(); track pos.id) {
          <div class="flex justify-between items-center p-3 rounded-lg bg-surface border border-line">
            <div class="flex flex-col">
              <span class="text-white font-bold tracking-tight">{{ pos.symbol }}</span>
              <span class="text-[10px] text-gray-500">Entry: {{ pos.price | number:'1.2-2' }}</span>
            </div>
            @let pnl = calculatePnl(pos);
            <div class="flex flex-col items-end">
              <span [class]="pnl.absolute >= 0 ? 'text-buy' : 'text-sell'" class="font-bold tracking-tight">
                {{ pnl.absolute >= 0 ? '+' : '' }}{{ pnl.absolute | number:'1.2-2' }}
              </span>
              <span [class]="pnl.percent >= 0 ? 'text-buy' : 'text-sell'" class="text-[10px] font-medium">
                {{ pnl.percent >= 0 ? '+' : '' }}{{ pnl.percent | number:'1.2-2' }}%
              </span>
            </div>
          </div>
        } @empty {
          <div class="text-gray-500 text-[10px] italic py-2">No open positions</div>
        }
      </div>
    </div>
  `
})
export class PnlDisplay {
  positions = input<OrderHistoryEntry[]>([]);
  symbolPrices = input<Map<string, number>>(new Map());

  calculatePnl(pos: OrderHistoryEntry) {
    const marketPrice = this.symbolPrices().get(pos.symbol);
    if (marketPrice === undefined) {
      return { absolute: 0, percent: 0 };
    }

    const priceDiff = marketPrice - pos.price;
    const absolute = pos.type === 'BUY' ? priceDiff * pos.size : -priceDiff * pos.size;
    const percent = (Math.abs(priceDiff) / pos.price) * (pos.leverage || 1) * (priceDiff >= 0 ? 1 : -1) * 100;

    return { absolute, percent };
  }
}
