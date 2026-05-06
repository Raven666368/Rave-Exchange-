import { Component, inject, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { JsonPipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { AlchemyService } from "./alchemy.service";

@Component({
  selector: "app-alchemy-status",
  standalone: true,
  imports: [JsonPipe, FormsModule, MatIconModule],
  template: `
    <div
      class="bg-gray-800 border border-gray-700 rounded-lg p-5 flex flex-col gap-4"
    >
      <div class="flex items-center justify-between">
        <h3
          class="text-sm font-semibold uppercase tracking-wider text-gray-400"
        >
          AI Pipeline Test Harness
        </h3>
        @if (alchemyService.isEvaluating()) {
          <span
            class="text-xs text-[#089981] animate-pulse font-mono bg-[#089981]/10 px-2 py-1 rounded"
          >
            RUNNING PIPELINE...
          </span>
        }
      </div>

      <!-- Parameter Inputs -->
      <div class="grid grid-cols-2 gap-3 mb-2">
        <div>
          <label for="sl-input" class="block text-xs text-gray-500 mb-1">Stop Loss (%)</label>
          <input
            type="number"
            id="sl-input"
            [(ngModel)]="slPercentInput"
            placeholder="e.g. 1.5"
            class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-300 focus:outline-none focus:border-[#089981]"
          />
        </div>
        <div>
          <label for="tp-input" class="block text-xs text-gray-500 mb-1">Take Profit (%)</label>
          <input
            type="number"
            id="tp-input"
            [(ngModel)]="tpPercentInput"
            placeholder="e.g. 5.0"
            class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-300 focus:outline-none focus:border-[#089981]"
          />
        </div>
      </div>

      <!-- Prompt Input -->
      <div>
        <label for="prompt-input" class="block text-xs text-gray-500 mb-1"
          >Test Prompt</label
        >
        <textarea
          id="prompt-input"
          [(ngModel)]="promptInput"
          rows="3"
          placeholder="Enter a market context (e.g. 'BTC breaking out of 60k resistance on high volume')"
          class="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm text-gray-300 focus:outline-none focus:border-[#089981] resize-none"
        ></textarea>
        <button
          (mousedown)="ctaReact($event)"
          (click)="runPipeline()"
          [disabled]="alchemyService.isEvaluating() || !promptInput.trim()"
          class="w-full mt-2 py-2 text-xs font-semibold tracking-wide uppercase bg-[#089981] hover:bg-[#089981]/80 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Run AI Pipeline
        </button>
      </div>

      <!-- Error State -->
      @if (alchemyService.lastError()) {
        <div
          class="p-3 bg-red-900/30 border border-red-800 text-red-500 text-xs rounded-md"
        >
          <span class="font-bold">Error:</span> {{ alchemyService.lastError() }}
        </div>
      }

      <!-- Result State -->
      @if (alchemyService.status(); as result) {
        <div class="border-t border-gray-700 pt-4 space-y-4">
          <!-- Pipeline Status Overview -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div
              class="p-2 bg-gray-900 rounded border border-gray-700 flex flex-col"
            >
              <span class="text-gray-500 uppercase text-[10px]"
                >Overall State</span
              >
              <span
                class="font-mono mt-1 font-bold"
                [class.text-green-500]="result.ok"
                [class.text-red-500]="!result.ok"
              >
                {{ result.ok ? "OK" : "FAILED" }}
              </span>
            </div>
            <div
              class="p-2 bg-gray-900 rounded border border-gray-700 flex flex-col"
            >
              <span class="text-gray-500 uppercase text-[10px]">Phase</span>
              <span class="font-mono mt-1 text-gray-300">{{
                result.phase
              }}</span>
            </div>
            <div
              class="p-2 bg-gray-900 rounded border border-gray-700 flex flex-col"
            >
              <span class="text-gray-500 uppercase text-[10px]"
                >Final Action</span
              >
              <span
                class="font-mono mt-1"
                [class.text-[#089981]]="
                  result.final_action === 'trade_candidate'
                "
                [class.text-yellow-500]="result.final_action === 'watchlist'"
                [class.text-gray-400]="result.final_action === 'no_trade'"
                [class.text-red-500]="result.final_action === 'rejected'"
              >
                {{ result.final_action }}
              </span>
            </div>
            <div
              class="p-2 bg-gray-900 rounded border border-gray-700 flex flex-col"
            >
              <span class="text-gray-500 uppercase text-[10px]"
                >Failed Gate</span
              >
              @if (result.failed_gate) {
                <span class="font-mono mt-1 text-red-500">{{
                  result.failed_gate
                }}</span>
              } @else {
                <span class="font-mono mt-1 text-gray-500">None</span>
              }
            </div>
            <div
              class="col-span-2 p-2 bg-gray-900 rounded border border-gray-700 flex flex-col items-center"
            >
              <span class="text-gray-500 uppercase text-[10px] mb-1"
                >Execution Allowed</span
              >
              <span
                class="font-mono font-bold text-lg"
                [class.text-[#089981]]="result.execution_allowed"
                [class.text-[#F23645]]="!result.execution_allowed"
              >
                {{ result.execution_allowed ? "APPROVED" : "BLOCKED" }}
              </span>
            </div>
          </div>

          <!-- Perception Bias Layer -->
          @if (result.perception; as p) {
            <div class="grid grid-cols-2 gap-3">
              <div
                class="p-4 bg-gray-900/80 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center relative overflow-hidden group"
              >
                <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-500/20 to-transparent"></div>
                <span class="text-gray-500 uppercase text-[9px] mb-2 font-bold tracking-[0.2em]"
                  >Macro Perception</span
                >
                <div 
                  class="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all duration-500"
                  [class]="getBiasClass(p.macro_bias)"
                >
                  <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">{{ getBiasIcon(p.macro_bias) }}</mat-icon>
                  <span>{{ p.macro_bias }}</span>
                </div>
              </div>
              <div
                class="p-4 bg-gray-900/80 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center relative overflow-hidden group"
              >
                <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-500/20 to-transparent"></div>
                <span class="text-gray-500 uppercase text-[9px] mb-2 font-bold tracking-[0.2em]"
                  >Technical Analysis</span
                >
                <div 
                  class="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all duration-500"
                  [class]="getBiasClass(p.technical_bias)"
                >
                  <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">{{ getBiasIcon(p.technical_bias) }}</mat-icon>
                  <span>{{ p.technical_bias }}</span>
                </div>
              </div>
            </div>
          }

          <!-- Risk Metrics Layer -->
          @if (result.risk; as r) {
            <div class="grid grid-cols-3 gap-3">
              <div class="p-3 bg-gray-900/80 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-500/20 to-transparent"></div>
                <span class="text-gray-500 uppercase text-[9px] mb-1 font-bold tracking-widest">Risk Score</span>
                <span class="font-mono text-xl font-black"
                  [class.text-red-500]="(r.risk_score || 0) > 70"
                  [class.text-yellow-500]="(r.risk_score || 0) > 40 && (r.risk_score || 0) <= 70"
                  [class.text-[#089981]]="(r.risk_score || 0) <= 40"
                >{{ r.risk_score !== undefined ? r.risk_score : 'N/A' }}</span>
              </div>
              <div class="p-3 bg-gray-900/80 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-500/20 to-transparent"></div>
                <span class="text-gray-500 uppercase text-[9px] mb-1 font-bold tracking-widest">Max Position</span>
                <span class="font-mono text-sm font-black text-gray-300">{{ r.max_position_size || 'N/A' }}</span>
              </div>
              <div class="p-3 bg-gray-900/80 rounded-xl border border-gray-700/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-500/20 to-transparent"></div>
                <span class="text-gray-500 uppercase text-[9px] mb-1 font-bold tracking-widest">Forced Mode</span>
                <span class="font-mono text-sm font-black mt-1 uppercase"
                  [class.text-[#F23645]]="r.forced_mode === 'SAFE_MODE'"
                  [class.text-yellow-500]="r.forced_mode === 'SCALP_MODE'"
                  [class.text-[#089981]]="r.forced_mode === 'TREND_MODE'"
                  [class.text-gray-300]="!r.forced_mode || (r.forced_mode !== 'SAFE_MODE' && r.forced_mode !== 'SCALP_MODE' && r.forced_mode !== 'TREND_MODE')"
                >{{ r.forced_mode || 'N/A' }}</span>
              </div>
            </div>
          }

          <!-- Phase Data Accordions (Simplified to raw display initially) -->
          <div class="space-y-2">
            <h4
              class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2"
            >
              Internal Payload
            </h4>

            <div
              class="text-[10px] bg-gray-900 text-gray-400 p-2 rounded overflow-hidden"
            >
              <div
                class="flex justify-between border-b border-gray-800 pb-1 mb-1"
              >
                <span>Perception:</span>
                <span
                  [class.text-green-500]="result.perception"
                  [class.text-gray-600]="!result.perception"
                  >{{
                    result.perception ? "COMPLETED" : "SKIPPED/FAILED"
                  }}</span
                >
              </div>
              <div
                class="flex justify-between border-b border-gray-800 pb-1 mb-1"
              >
                <span>Risk:</span>
                <span
                  [class.text-green-500]="result.risk"
                  [class.text-gray-600]="!result.risk"
                  >{{ result.risk ? "COMPLETED" : "SKIPPED/FAILED" }}</span
                >
              </div>
              <div
                class="flex justify-between border-b border-gray-800 pb-1 mb-1"
              >
                <span>Execution:</span>
                <span
                  [class.text-green-500]="result.execution"
                  [class.text-gray-600]="!result.execution"
                  >{{ result.execution ? "COMPLETED" : "SKIPPED/FAILED" }}</span
                >
              </div>
              <div class="flex justify-between">
                <span>Journal:</span>
                <span
                  [class.text-green-500]="result.journal"
                  [class.text-gray-600]="!result.journal"
                  >{{ result.journal ? "COMPLETED" : "SKIPPED/FAILED" }}</span
                >
              </div>
            </div>

            <div class="mt-4">
              <details class="group">
                <summary
                  class="text-xs text-blue-400 cursor-pointer hover:underline outline-none"
                >
                  View Full Output JSON
                </summary>
                <pre
                  class="mt-2 text-[10px] text-gray-300 font-mono bg-black p-3 rounded overflow-x-auto border border-gray-800 max-h-64 custom-scrollbar"
                  >{{ result | json }}</pre
                >
              </details>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AlchemyStatusComponent {
  @Input() tpLevels: { price: number; percent: number }[] = [];
  public alchemyService = inject(AlchemyService);
  public promptInput =
    "Provide short analysis of latest market condition assuming overall neutral state for demonstration purposes.";

  public slPercentInput: number | null = null;
  public tpPercentInput: number | null = null;

  ctaReact(event: Event) {
    const el = event.currentTarget as HTMLElement;
    import('motion').then(({ animate }) => {
      animate(el, { scale: [1, 0.95, 1.05, 1] }, { duration: 0.3, ease: "easeInOut" });
    });
  }

  runPipeline() {
    if (!this.promptInput.trim()) return;
    this.alchemyService.runPipeline(this.promptInput.trim(), this.tpLevels, this.slPercentInput, this.tpPercentInput);
  }

  getBiasClass(bias: string): string {
    const b = bias.toLowerCase();
    if (b.includes("bull") || b.includes("long")) {
      return "bg-green-500/20 text-green-400 border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
    }
    if (b.includes("bear") || b.includes("short")) {
      return "bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]";
    }
    return "bg-gray-700/40 text-gray-300 border-gray-500/30";
  }

  getBiasIcon(bias: string): string {
    const b = bias.toLowerCase();
    if (b.includes("bull") || b.includes("long")) return "trending_up";
    if (b.includes("bear") || b.includes("short")) return "trending_down";
    return "trending_flat";
  }
}
