import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { DecimalPipe } from "@angular/common";

export interface OrderPreview {
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  stopLoss?: number;
  takeProfit?: number;
  tpLevels?: { price: number; percent: number }[];
  leverage?: number;
  marginMode?: "isolated" | "cross" | "ISOLATED" | "CROSS";
  estimatedMargin?: number;
}

@Component({
  selector: "app-trade-confirmation-modal",
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto"
    >
      <div
        class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] transform animate-in zoom-in-95 duration-300"
      >
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-500"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h3
                class="text-xl font-black text-white tracking-widest uppercase"
              >
                Confirm Trade
              </h3>
              <p
                class="text-xs text-gray-400 font-mono uppercase tracking-widest"
              >
                Verify Order Details
              </p>
            </div>
          </div>
          <button
            (click)="cancelTrade.emit()"
            class="text-gray-400 hover:text-white transition"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-4 mb-8">
          <div class="grid grid-cols-2 gap-y-3 text-[10px]">
            <div class="text-gray-500 uppercase tracking-widest">Symbol</div>
            <div class="text-white font-mono text-right capitalize">
              {{ order()?.symbol }}
            </div>

            <div class="text-gray-500 uppercase tracking-widest">Side</div>
            <div
              class="font-mono text-right font-bold uppercase"
              [class]="
                order()?.side === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'
              "
            >
              {{ order()?.side }}
            </div>

            <div class="text-gray-500 uppercase tracking-widest">
              Target Price
            </div>
            <div class="text-white font-mono text-right">
              ~ \${{ order()?.price || 0 | number: "1.2-2" }}
            </div>

            <div class="text-gray-500 uppercase tracking-widest">
              Size (Contracts)
            </div>
            <div class="text-white font-mono text-right">
              {{ order()?.size }}
            </div>

            @if (order()?.leverage) {
              <div class="text-gray-500 uppercase tracking-widest">Leverage</div>
              <div class="text-white font-mono text-right">{{ order()?.leverage }}x</div>
            }

            @if (order()?.marginMode) {
              <div class="text-gray-500 uppercase tracking-widest">Margin Mode</div>
              <div class="text-white font-mono text-right">{{ order()?.marginMode }}</div>
            }

            @if (order()?.estimatedMargin) {
              <div class="text-gray-500 uppercase tracking-widest">Est. Margin</div>
              <div class="text-white font-mono text-right">\${{ order()?.estimatedMargin | number: "1.2-2" }}</div>
            }

            @if (order()?.stopLoss) {
              <div
                class="text-gray-500 uppercase tracking-widest text-[#f23645]"
              >
                Stop Loss
              </div>
              <div class="text-[#f23645] font-mono text-right">
                \${{ order()?.stopLoss | number: "1.2-2" }}
              </div>
            }

            @if (order()?.takeProfit && (!order()?.tpLevels || order()?.tpLevels?.length === 0)) {
              <div
                class="text-gray-500 uppercase tracking-widest text-[#089981]"
              >
                Take Profit
              </div>
              <div class="text-[#089981] font-mono text-right">
                \${{ order()?.takeProfit | number: "1.2-2" }}
              </div>
            }
          </div>

          @if (order()?.tpLevels && order()?.tpLevels?.length! > 0) {
          <div class="mt-4 border-t border-[#363c4e] pt-4">
             <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-2">TP Scaling Ladder</div>
             <div class="space-y-1">
                @for (tp of order()?.tpLevels; track tp.price) {
                  <div class="flex justify-between items-center text-[10px] font-mono">
                     <span class="text-[#089981]">TP Level</span>
                     <span class="text-white">\${{tp.price | number: "1.2-2"}} ({{tp.percent}}%)</span>
                  </div>
                }
             </div>
          </div>
          }

          <div
            class="p-4 bg-[#131722] border border-[#363c4e] rounded-xl text-center mt-4"
          >
            <div
              class="text-[10px] text-gray-500 uppercase tracking-widest mb-1"
            >
              Est. Notional Value
            </div>
            <div class="text-2xl font-black text-white">
              \${{
                (order()?.price || 0) * (order()?.size || 0) | number: "1.2-2"
              }}
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <button
            (mousedown)="ctaReact($event)"
            (click)="confirmTrade.emit()"
            class="w-full py-3 px-4 bg-[#089981] hover:bg-[#089981]/80 text-white font-black rounded-lg transition uppercase text-xs tracking-widest shadow-[0_0_15px_rgba(8,153,129,0.4)]"
          >
            CONFIRM
          </button>
          <button
            (click)="cancelTrade.emit()"
            class="w-full py-3 px-4 bg-[#1e222d] hover:bg-[#2a2a35] text-white font-black rounded-lg transition uppercase text-xs tracking-widest border border-[#363c4e]"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TradeConfirmationModalComponent {
  order = input<OrderPreview | null>();
  confirmTrade = output<void>();
  cancelTrade = output<void>();

  ctaReact(event: Event) {
    const el = event.currentTarget as HTMLElement;
    import('motion').then(({ animate }) => {
      animate(el, { scale: [1, 0.95, 1.05, 1] }, { duration: 0.3, ease: "easeInOut" });
    });
  }
}
