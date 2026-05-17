import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DecisionTraceEvent } from '../../core/state/event-schema';

@Component({
  selector: 'app-decision-trace',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden">
      <div class="bg-[#1e222d] px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between items-center">
        <span>Decision Trace (Reasoning Terminal)</span>
        <mat-icon class="text-gray-500" style="font-size: 14px; width: 14px; height: 14px;">account_tree</mat-icon>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 custom-scrollbar font-mono text-[10px]">
        @if (traces().length > 0) {
          @for (trace of traces(); track $index) {
          <div class="mb-4 last:mb-0 border border-[#363c4e] rounded bg-[#131722] p-2">
            <div class="flex justify-between items-center mb-2 pb-1 border-b border-[#1e222d]">
              <span class="text-purple-400">[TRACE ID #{{ trace.id || $index + 8842 }}]</span>
              <span class="text-gray-500">{{ trace.timestamp || '0.000s' }}</span>
            </div>
            
            <div class="mb-2">
              <span class="text-gray-500 mr-2">FINAL DECISION:</span>
              <span class="font-bold" [class.text-green-500]="trace.final_decision === 'BUY'" [class.text-red-500]="trace.final_decision === 'SELL'" [class.text-gray-400]="trace.final_decision === 'NEUTRAL'">{{ trace.final_decision || 'NEUTRAL' }}</span>
            </div>

            <div class="mb-2">
              <span class="text-gray-500">CONTRIBUTORS:</span>
              <div class="pl-2 border-l border-[#363c4e] mt-1 space-y-1">
                @for (contributor of trace.contributors; track $index) {
                  <div class="text-gray-300">- {{ contributor }}</div>
                }
              </div>
            </div>

            <div class="mt-2 pt-2 border-t border-[#1e222d]">
              <span class="text-gray-500">ARBITRATION SCORE:</span>
              <div class="grid grid-cols-2 gap-2 mt-1">
                <div>BUY = <span class="text-green-400">{{ trace.scores['BUY'] | number:'1.2-2' }}</span></div>
                <div>SELL = <span class="text-red-400">{{ trace.scores['SELL'] | number:'1.2-2' }}</span></div>
              </div>
            </div>
          </div>
          }
        } @else {
          <div class="h-full flex items-center justify-center flex-col text-gray-500 opacity-50">
            <mat-icon class="mb-2">analytics</mat-icon>
            <p>AWAITING DECISIONS</p>
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
export class DecisionTraceComponent {
  traces = input<DecisionTraceEvent[]>([]);
}
