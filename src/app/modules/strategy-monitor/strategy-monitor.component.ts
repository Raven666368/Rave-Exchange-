import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StrategyWeightEvent } from '../../core/state/event-schema';

@Component({
  selector: 'app-strategy-monitor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden">
      <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between items-center">
        <span>Strategy Contribution Matrix</span>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 custom-scrollbar font-mono text-[10px]">
        @if (strategies().length > 0) {
          <div class="text-blue-400 mb-3 border-b border-[#1e222d] pb-2">[EURUSD {{ activeSide() }}]</div>
          <div class="space-y-3">
            @for (strategy of strategies(); track strategy.name) {
              <div>
                <div class="flex justify-between mb-1 text-gray-300">
                  <span>{{ strategy.name }}</span>
                  <span [class.text-green-400]="strategy.weight > 20" [class.text-gray-500]="strategy.weight <= 20">{{ strategy.weight }}%</span>
                </div>
                <div class="h-1.5 w-full bg-[#1e222d] rounded overflow-hidden">
                  <div class="h-full bg-blue-500 rounded" [style.width.%]="strategy.weight"></div>
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Placeholder Mock Output if no data passed yet -->
           <div class="text-blue-400 mb-3 border-b border-[#1e222d] pb-2">[EURUSD BUY]</div>
            <div class="space-y-3">
              <div>
                  <div class="flex justify-between mb-1 text-gray-300">
                    <span>Momentum Worker</span>
                    <span class="text-green-400">42%</span>
                  </div>
                  <div class="h-1.5 w-full bg-[#1e222d] rounded overflow-hidden flex">
                    <!-- Text based block to emulate user design, but using css -->
                    <div class="h-full bg-cyan-500" style="width: 42%"></div>
                  </div>
              </div>
              <div>
                  <div class="flex justify-between mb-1 text-gray-300">
                    <span>ICT Liquidity Model</span>
                    <span class="text-green-400">28%</span>
                  </div>
                  <div class="h-1.5 w-full bg-[#1e222d] rounded overflow-hidden flex">
                    <div class="h-full bg-cyan-600" style="width: 28%"></div>
                  </div>
              </div>
              <div>
                  <div class="flex justify-between mb-1 text-gray-300">
                    <span>Regime AI</span>
                    <span class="text-gray-400">19%</span>
                  </div>
                  <div class="h-1.5 w-full bg-[#1e222d] rounded overflow-hidden flex">
                    <div class="h-full bg-blue-700" style="width: 19%"></div>
                  </div>
              </div>
              <div>
                  <div class="flex justify-between mb-1 text-gray-300">
                    <span>Mean Reversion</span>
                    <span class="text-gray-500">11%</span>
                  </div>
                  <div class="h-1.5 w-full bg-[#1e222d] rounded overflow-hidden flex">
                    <div class="h-full bg-blue-900" style="width: 11%"></div>
                  </div>
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
export class StrategyMonitorComponent {
  strategies = input<StrategyWeightEvent[]>([]);
  activeSide = input<string>('BUY');
}
