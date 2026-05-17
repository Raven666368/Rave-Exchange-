import {ChangeDetectionStrategy, Component, input, output, signal, computed} from '@angular/core';
import {DecimalPipe, DatePipe} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {OrderHistoryEntry} from './app'; // We'll need to export OrderHistoryEntry from app.ts

@Component({
  selector: 'app-historical-trades-modal',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-6 max-w-4xl w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] transform animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between mb-4 pb-4 border-b border-[#363c4e]">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-[#089981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 class="text-xl font-black text-white tracking-widest uppercase">Historical Trade Data</h2>
          </div>
          <button (click)="closeModal.emit()" class="text-gray-400 hover:text-white transition">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="flex flex-col gap-1">
            <label for="filter-symbol" class="text-[10px] text-gray-500 uppercase tracking-widest">Symbol</label>
            <select id="filter-symbol" [(ngModel)]="filterSymbol" class="bg-[#131722] border border-[#363c4e] rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#089981] outline-none">
              <option value="ALL">All Symbols</option>
              @for (symbol of symbols(); track symbol) {
                <option [value]="symbol">{{ symbol }}</option>
              }
            </select>
          </div>
          
          <div class="flex flex-col gap-1">
            <label for="filter-type" class="text-[10px] text-gray-500 uppercase tracking-widest">Order Type</label>
            <select id="filter-type" [(ngModel)]="filterType" class="bg-[#131722] border border-[#363c4e] rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#089981] outline-none">
              <option value="ALL">All Types</option>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label for="filter-start-date" class="text-[10px] text-gray-500 uppercase tracking-widest">Date Range</label>
            <div class="flex items-center gap-2">
              <input id="filter-start-date" type="date" [(ngModel)]="filterStartDate" class="w-full bg-[#131722] border border-[#363c4e] rounded-lg px-3 py-2 text-gray-300 font-mono text-xs focus:border-[#089981] outline-none [color-scheme:dark]" />
              <span class="text-gray-500">-</span>
              <input aria-label="End Date" type="date" [(ngModel)]="filterEndDate" class="w-full bg-[#131722] border border-[#363c4e] rounded-lg px-3 py-2 text-gray-300 font-mono text-xs focus:border-[#089981] outline-none [color-scheme:dark]" />
            </div>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto custom-scrollbar border border-[#363c4e] rounded-lg bg-[#131722]">
          <table class="w-full text-left font-mono text-[10px]">
            <thead class="text-gray-500 sticky top-0 bg-[#1e222d] shadow-sm uppercase z-10 border-b border-[#363c4e]">
              <tr>
                <th class="py-3 px-4">Time</th>
                <th class="py-3 px-4">Symbol</th>
                <th class="py-3 px-4 text-center">Type</th>
                <th class="py-3 px-4 text-right">Price</th>
                <th class="py-3 px-4 text-right">Size</th>
                <th class="py-3 px-4 text-center">Margin</th>
                <th class="py-3 px-4 text-right">Total</th>
                <th class="py-3 px-4 text-right">Status</th>
                <th class="py-3 px-4 text-right">ID</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#363c4e]">
              @for (entry of filteredHistory(); track entry.id) {
                <tr class="hover:bg-white/5 transition-colors">
                  <td class="py-3 px-4 text-gray-400">{{ entry.timestamp | date:'short' }}</td>
                  <td class="py-3 px-4 text-gray-300 font-bold tracking-wider">{{ entry.symbol }}</td>
                  <td class="py-3 px-4 text-center">
                    <span [class]="entry.type === 'BUY' ? 'text-[#089981] font-bold bg-[#089981]/10 px-2 py-0.5 rounded' : 'text-[#f23645] font-bold bg-[#f23645]/10 px-2 py-0.5 rounded'">
                      {{ entry.type }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right text-gray-200">\${{ (entry.price || 0) | number:'1.2-2' }}</td>
                  <td class="py-3 px-4 text-right text-gray-200">{{ (entry.size || 0) | number:'1.2-4' }}</td>
                  <td class="py-3 px-4 text-center">
                    @if (entry.leverage) {
                      <span class="text-gray-400 bg-gray-800 px-1 py-0.5 rounded">{{ entry.leverage }}x <span class="capitalize text-[8px]">{{ entry.marginMode || 'cross' }}</span></span>
                    }
                  </td>
                  <td class="py-3 px-4 text-right text-white font-bold">\${{ ((entry.price || 0) * (entry.size || 0)) | number:'1.2-2' }}</td>
                  <td class="py-3 px-4 text-right">
                    <span [class]="entry.status === 'FILLED' ? 'text-[#089981]' : (entry.status === 'CANCELLED' ? 'text-gray-500' : 'text-yellow-500')">
                      {{ entry.status || 'PENDING' }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right text-gray-600">{{ entry.id }}</td>
                </tr>
              }
              @if (filteredHistory().length === 0) {
                <tr>
                  <td colspan="9" class="py-12 text-center text-gray-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                      <svg class="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span class="uppercase tracking-widest text-[10px]">No trades found matching filters</span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoricalTradesModalComponent {
  history = input.required<OrderHistoryEntry[]>();
  symbols = input.required<string[]>();
  closeModal = output<void>();

  filterSymbol = signal<string>('ALL');
  filterType = signal<string>('ALL');
  filterStartDate = signal<string>('');
  filterEndDate = signal<string>('');

  filteredHistory = computed(() => {
    let filtered = this.history();
    const symbol = this.filterSymbol();
    const type = this.filterType();
    const start = this.filterStartDate();
    const end = this.filterEndDate();

    if (symbol !== 'ALL') {
      filtered = filtered.filter(entry => entry.symbol === symbol);
    }
    
    if (type !== 'ALL') {
      filtered = filtered.filter(entry => entry.type === type);
    }

    if (start) {
      const startDate = new Date(start);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(entry => new Date(entry.timestamp) >= startDate);
    }

    if (end) {
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(entry => new Date(entry.timestamp) <= endDate);
    }

    return filtered;
  });
}
