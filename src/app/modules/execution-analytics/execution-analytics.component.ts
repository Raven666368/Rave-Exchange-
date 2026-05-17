import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExecutionMetric } from '../../core/state/event-schema';

@Component({
  selector: 'app-execution-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden">
      <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between items-center">
        <span>Execution Quality</span>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 custom-scrollbar font-mono text-[10px]">
        @if (executions().length > 0) {
          @for (exec of executions(); track $index) {
             <div class="mb-3 last:mb-0">
               <div class="text-gray-300 font-bold mb-1 flex justify-between">
                 <span>{{ exec.symbol || 'UNKNOWN' }}</span>
                 <span [class.text-red-400]="exec.slip > 0" [class.text-green-400]="exec.slip <= 0">{{ exec.slip > 0 ? 'Negative' : 'Positive' }} Slip</span>
               </div>
               <div class="grid grid-cols-2 gap-x-4 mt-1 text-gray-500">
                 <div>Intent: <span class="text-gray-300">{{ exec.intent | number:'1.2-2' }}</span></div>
                 <div>Fill: <span class="text-white">{{ exec.fill | number:'1.2-2' }}</span></div>
                 <div>Slip: <span [class.text-red-400]="exec.slip > 0" [class.text-green-400]="exec.slip <= 0">{{ exec.slip > 0 ? '+' : '' }}{{ exec.slip | number:'1.1-1' }}</span></div>
                 <div>Latency: <span [class.text-red-400]="exec.latency > 150" [class.text-yellow-400]="exec.latency > 50 && exec.latency <= 150" [class.text-green-400]="exec.latency <= 50">{{ exec.latency }}ms</span></div>
               </div>
               <div class="mt-1 h-1 bg-[#1e222d] rounded flex overflow-hidden">
                 <div class="h-full" [class.bg-red-500]="exec.slip > 0" [class.bg-green-500]="exec.slip <= 0" [style.width.%]="exec.slip > 0 ? 100 : Math.min(100, Math.abs(exec.slip) * 10)"></div>
               </div>
             </div>
          }
        } @else {
          <!-- Mock Institutional Execution feed -->
          <div class="mb-3">
             <div class="text-gray-300 font-bold mb-1">BTCUSDT</div>
             <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-500 pl-1 border-l-2 border-[#1e222d]">
               <div>Intent: <span class="text-gray-300">63251.2</span></div>
               <div>Fill: <span class="text-white">63254.7</span></div>
               <div>Slip: <span class="text-red-400">+3.5</span></div>
               <div>Latency: <span class="text-yellow-400">84ms</span></div>
             </div>
          </div>
          <div class="mb-3">
             <div class="text-gray-300 font-bold mb-1">ETHUSDT</div>
             <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-500 pl-1 border-l-2 border-[#1e222d]">
               <div>Intent: <span class="text-gray-300">3410.5</span></div>
               <div>Fill: <span class="text-white">3410.5</span></div>
               <div>Slip: <span class="text-green-400">0.0</span></div>
               <div>Latency: <span class="text-yellow-400">62ms</span></div>
             </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #363c4e; }
  `]
})
export class ExecutionAnalyticsComponent {
  executions = input<ExecutionMetric[]>([]);
  Math = Math;
}
