import { Component, input } from "@angular/core";
import { CommonModule } from "@angular/common";

export interface TradeExecutionLog {
  time: string;
  symbol: string;
  action: string;
  outcome: 'success' | 'failed' | 'pending';
  message: string;
}

@Component({
  selector: "app-execution-logs",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-[#1e222d] rounded-xl p-5 border border-[#363c4e] shadow-lg flex-1 overflow-hidden flex flex-col min-h-[300px]">
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#363c4e]">
        <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Trade Execution Logs
        </h2>
        <span class="text-[#089981] text-[10px] animate-pulse font-mono">Bybit API</span>
      </div>
      <div class="flex-1 overflow-y-auto custom-scrollbar">
        @if (logs().length === 0) {
          <div class="flex flex-col items-center justify-center h-full text-gray-600 opacity-50 space-y-2">
            <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p class="text-[10px] uppercase tracking-widest text-center">
              No executions yet
            </p>
          </div>
        } @else {
          <table class="w-full text-left font-mono text-[10px]">
            <thead class="text-gray-500 sticky top-0 bg-[#1e222d] z-10 mb-2 uppercase">
              <tr>
                <th class="py-2">Time</th>
                <th class="py-2">Symbol</th>
                <th class="py-2 text-center">Action</th>
                <th class="py-2 text-center">Status</th>
                <th class="py-2 text-right">Message</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#363c4e]">
              @for (log of logs(); track log.time + log.symbol + $index) {
                <tr class="hover:bg-white/5 transition-colors">
                  <td class="py-2 text-gray-400 align-top">
                    {{ log.time }}
                  </td>
                  <td class="py-2 text-gray-300 align-top">{{ log.symbol }}</td>
                  <td class="py-2 text-center align-top">
                    <span [class]="log.action === 'BUY' ? 'text-[#089981] font-bold' : (log.action === 'SELL' ? 'text-[#f23645] font-bold' : 'text-blue-500 font-bold')">
                      {{ log.action }}
                    </span>
                  </td>
                  <td class="py-2 text-center align-top">
                    <span [class]="log.outcome === 'success' ? 'text-[#089981]' : (log.outcome === 'failed' ? 'text-[#f23645]' : 'text-yellow-500')">
                      {{ log.outcome | uppercase }}
                    </span>
                  </td>
                  <td class="py-2 text-right text-gray-400 break-words max-w-[200px]">
                    {{ log.message }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `
})
export class ExecutionLogsComponent {
  logs = input<TradeExecutionLog[]>([]);
}
