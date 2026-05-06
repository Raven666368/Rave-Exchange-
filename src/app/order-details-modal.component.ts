import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {DecimalPipe, DatePipe} from '@angular/common';

export interface Order {
  id: string;
  type: string;
  symbol: string;
  status?: string;
  timestamp: Date;
  price?: number;
  size?: number;
  stopPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage?: number;
  marginMode?: string;
}

@Component({
  selector: 'app-order-details-modal',
  standalone: true,
  imports: [DecimalPipe, DatePipe],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto">
      <div class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] transform animate-in zoom-in-95 duration-300">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div [class]="order()?.type === 'BUY' ? 'w-12 h-12 bg-[#089981]/20 rounded-full flex items-center justify-center text-[#089981]' : 'w-12 h-12 bg-[#f23645]/20 rounded-full flex items-center justify-center text-[#f23645]'">
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-black text-white tracking-widest uppercase">Order Details</h3>
              <p class="text-xs text-gray-400 font-mono uppercase tracking-widest">ID: {{ order()?.id }}</p>
            </div>
          </div>
          <button (click)="closeModal.emit()" class="text-gray-400 hover:text-white transition">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4 mb-8">
          <div class="grid grid-cols-2 gap-y-3 text-[10px]">
            <div class="text-gray-500 uppercase tracking-widest">Symbol</div>
            <div class="text-white font-mono text-right capitalize">{{ order()?.symbol }}</div>
            
            <div class="text-gray-500 uppercase tracking-widest">Type</div>
            <div class="font-mono text-right font-bold uppercase" [class]="order()?.type === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'">{{ order()?.type }}</div>
            
            @if (order()?.leverage) {
              <div class="text-gray-500 uppercase tracking-widest">Margin</div>
              <div class="text-white font-mono text-right capitalize">{{ order()?.leverage }}x {{ order()?.marginMode }}</div>
            }

            <div class="text-gray-500 uppercase tracking-widest">Status</div>
            <div class="text-white font-mono text-right uppercase">
               @if (order()?.status) {
                 {{ order()?.status }}
               } @else {
                 PENDING
               }
            </div>

            <div class="text-gray-500 uppercase tracking-widest">Timestamp</div>
            <div class="text-white font-mono text-right">{{ order()?.timestamp | date:'medium' }}</div>

            @if (order()?.stopPrice) {
              <div class="text-gray-500 uppercase tracking-widest text-yellow-500">Trigger Price</div>
              <div class="text-yellow-500 font-mono text-right">\${{ (order()?.stopPrice || 0) | number:'1.2-2' }}</div>
            }
            
            <div class="text-gray-500 uppercase tracking-widest">Price</div>
            <div class="text-white font-mono text-right">\${{ (order()?.price || 0) | number:'1.2-2' }}</div>
            
            <div class="text-gray-500 uppercase tracking-widest">Size</div>
            <div class="text-white font-mono text-right">{{ order()?.size }}</div>

            @if (order()?.takeProfit) {
              <div class="text-gray-500 uppercase tracking-widest text-[#089981]">Take Profit</div>
              <div class="text-[#089981] font-mono text-right">\${{ order()?.takeProfit | number:'1.2-2' }}</div>
            }

            @if (order()?.stopLoss) {
              <div class="text-gray-500 uppercase tracking-widest text-[#f23645]">Stop Loss</div>
              <div class="text-[#f23645] font-mono text-right">\${{ order()?.stopLoss | number:'1.2-2' }}</div>
            }
          </div>

          <div class="p-4 bg-[#131722] border border-[#363c4e] rounded-xl text-center">
            <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Value</div>
            <div class="text-2xl font-black text-white">
              \${{ ((order()?.price || 0) * (order()?.size || 0)) | number:'1.2-2' }}
            </div>
          </div>
        </div>

        <div class="flex justify-center">
          <button (click)="closeModal.emit()" class="w-full py-3 px-4 bg-[#1e222d] hover:bg-[#2a2a35] text-white font-black rounded-lg transition uppercase text-xs tracking-widest border border-[#363c4e]">
            Close
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsModalComponent {
  order = input<Order | null>();
  closeModal = output<void>();
}
