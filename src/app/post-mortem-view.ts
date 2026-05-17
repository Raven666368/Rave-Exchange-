import { Component, OnInit, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";

@Component({
  selector: "app-post-mortem-view",
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <mat-icon class="text-[#089981]">analytics</mat-icon>
            Post-Mortem Analytics
          </h2>
          <p class="text-[10px] text-gray-400 uppercase tracking-widest mt-1">
            Correlating Alchemy Bias with Testnet Bridge Outcomes
          </p>
        </div>
        <div class="flex gap-2">
           <button (click)="refresh()" class="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400">
             <mat-icon class="!text-lg">refresh</mat-icon>
           </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-[#131722] p-4 rounded-lg border border-[#363c4e] flex flex-col items-center">
          <span class="text-[10px] text-gray-500 uppercase font-black mb-1">Total Signals</span>
          <span class="text-2xl font-mono text-white">{{ stats().total }}</span>
        </div>
        <div class="bg-[#131722] p-4 rounded-lg border border-[#363c4e] flex flex-col items-center">
          <span class="text-[10px] text-gray-500 uppercase font-black mb-1">Execution Rate</span>
          <span class="text-2xl font-mono text-white">{{ stats().execRate }}%</span>
        </div>
        <div class="bg-[#131722] p-4 rounded-lg border border-[#363c4e] flex flex-col items-center">
          <span class="text-[10px] text-gray-500 uppercase font-black mb-1">Avg Slippage</span>
          <span class="text-2xl font-mono text-[#089981]">{{ stats().avgSlippage }}%</span>
        </div>
        <div class="bg-[#131722] p-4 rounded-lg border border-[#363c4e] flex flex-col items-center">
          <span class="text-[10px] text-gray-500 uppercase font-black mb-1">Veto Purity</span>
          <span class="text-2xl font-mono text-blue-400">{{ stats().vetoPurity }}%</span>
        </div>
      </div>

      <!-- Analysis Tables -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Bias Distribution -->
        <div class="space-y-4">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span class="w-1 h-3 bg-blue-500 rounded-full"></span>
            Macro Bias Distribution
          </h3>
          <div class="bg-[#131722] rounded-lg border border-[#363c4e] overflow-hidden">
            <table class="w-full text-left text-[11px]">
              <thead class="bg-[#1e222d] border-b border-[#363c4e]">
                <tr>
                  <th class="px-4 py-2 uppercase text-gray-500">Bias</th>
                  <th class="px-4 py-2 uppercase text-gray-500 text-right">Signals</th>
                  <th class="px-4 py-2 uppercase text-gray-500 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#363c4e]/30">
                @for (item of macroStats(); track item.bias) {
                <tr class="hover:bg-white/5 transition-colors">
                  <td class="px-4 py-3 font-mono text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full" [ngClass]="getBiasDot(item.bias)"></span>
                    {{ item.bias }}
                  </td>
                  <td class="px-4 py-3 text-right text-gray-400">{{ item.count }}</td>
                  <td class="px-4 py-3 text-right">
                    <div class="flex flex-col items-right">
                      <span class="text-white">{{ item.conversion }}%</span>
                      <div class="w-16 h-1 bg-gray-700 ml-auto mt-1 rounded-full overflow-hidden">
                        <div class="h-full bg-[#089981]" [style.width.%]="item.conversion"></div>
                      </div>
                    </div>
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Technical Analysis Performance -->
        <div class="space-y-4">
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <span class="w-1 h-3 bg-purple-500 rounded-full"></span>
            Technical Bias Delta
          </h3>
          <div class="bg-[#131722] rounded-lg border border-[#363c4e] overflow-hidden">
            <table class="w-full text-left text-[11px]">
              <thead class="bg-[#1e222d] border-b border-[#363c4e]">
                <tr>
                  <th class="px-4 py-2 uppercase text-gray-500">Tech Lead</th>
                  <th class="px-4 py-2 uppercase text-gray-500 text-right">Signals</th>
                  <th class="px-4 py-2 uppercase text-gray-500 text-right">Avg Risk</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#363c4e]/30">
                @for (item of techStats(); track item.bias) {
                <tr class="hover:bg-white/5 transition-colors">
                  <td class="px-4 py-3 font-mono text-white flex items-center gap-2">
                     <span class="w-2 h-2 rounded-full" [ngClass]="getBiasDot(item.bias)"></span>
                     {{ item.bias }}
                  </td>
                  <td class="px-4 py-3 text-right text-gray-400">{{ item.count }}</td>
                  <td class="px-4 py-3 text-right font-mono text-yellow-500/80">{{ item.avgRisk }}</td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent Tagged Journal -->
      <div class="mt-12">
         <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span class="w-1 h-3 bg-green-500 rounded-full"></span>
            Recent Logged Perception Patterns
          </h3>
          <div class="bg-[#131722] rounded-lg border border-[#363c4e] overflow-x-auto">
            <table class="w-full text-left text-[10px]">
              <thead class="bg-[#1e222d] border-b border-[#363c4e]">
                <tr>
                  <th class="px-4 py-2 text-gray-500 uppercase">Time</th>
                  <th class="px-4 py-2 text-gray-500 uppercase">Perception</th>
                  <th class="px-4 py-2 text-gray-500 uppercase">Order</th>
                  <th class="px-4 py-2 text-gray-500 uppercase">Execution</th>
                  <th class="px-4 py-2 text-gray-500 uppercase text-right">Status</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#363c4e]/30">
                @for (entry of entries(); track entry.id) {
                <tr class="hover:bg-white/5 transition-colors">
                  <td class="px-4 py-2 text-gray-500 font-mono">{{ entry.timestamp | date:'HH:mm:ss' }}</td>
                  <td class="px-4 py-2">
                    <div class="flex gap-1">
                      <span class="px-1.5 py-0.5 rounded text-[8px] border" [ngClass]="getBiasClass(entry.macroBias)">MACRO: {{ entry.macroBias || 'N/A' }}</span>
                      <span class="px-1.5 py-0.5 rounded text-[8px] border" [ngClass]="getBiasClass(entry.technicalBias)">TECH: {{ entry.technicalBias || 'N/A' }}</span>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-white font-mono">{{ entry.side }} {{ entry.qty }} @ {{ entry.price }}</td>
                  <td class="px-4 py-2 text-gray-400 truncate max-w-[200px]">{{ entry.vetoReason }}</td>
                  <td class="px-4 py-2 text-right">
                    <span class="px-2 py-0.5 rounded-full text-[8px] font-bold"
                      [ngClass]="{
                        'bg-green-500/10 text-green-500': entry.status === 'FILLED_SIMULATED',
                        'bg-red-500/10 text-red-500': entry.status === 'vetoed',
                        'bg-blue-500/10 text-blue-500': entry.status === 'Confirmed'
                      }">{{ entry.status }}</span>
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class PostMortemView implements OnInit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entries = signal<any[]>([]);

  stats = computed(() => {
    const e = this.entries();
    if (e.length === 0) return { total: 0, execRate: 0, avgSlippage: 0, vetoPurity: 0 };

    const total = e.length;
    const executed = e.filter(ex => ex.status === 'FILLED_SIMULATED' || ex.status === 'Confirmed').length;
    
    let totalSlippage = 0;
    let slipCount = 0;
    e.forEach(ex => {
       if (ex.vetoReason?.includes('Slippage:')) {
          const match = ex.vetoReason.match(/Slippage: ([\d.]+)%/);
          if (match) {
             totalSlippage += parseFloat(match[1]);
             slipCount++;
          }
       }
    });

    return {
      total,
      execRate: Math.round((executed / total) * 100),
      avgSlippage: slipCount > 0 ? (totalSlippage / slipCount).toFixed(3) : "0",
      vetoPurity: Math.round((e.filter(v => v.status === 'vetoed').length / total) * 100)
    };
  });

  macroStats = computed(() => {
     const e = this.entries();
     const map = new Map<string, { count: number, converted: number }>();
     
     e.forEach(ex => {
        const b = ex.macroBias || 'UNKNOWN';
        const curr = map.get(b) || { count: 0, converted: 0 };
        curr.count++;
        if (ex.status === 'FILLED_SIMULATED' || ex.status === 'Confirmed') curr.converted++;
        map.set(b, curr);
     });

     return Array.from(map.entries()).map(([bias, s]) => ({
        bias,
        count: s.count,
        conversion: Math.round((s.converted / s.count) * 100)
     })).sort((a,b) => b.count - a.count);
  });

  techStats = computed(() => {
     const e = this.entries();
     const map = new Map<string, { count: number, sumRisk: number }>();
     
     e.forEach(ex => {
        const b = ex.technicalBias || 'UNKNOWN';
        const curr = map.get(b) || { count: 0, sumRisk: 0 };
        curr.count++;
        curr.sumRisk += ex.riskScore || 0.5;
        map.set(b, curr);
     });

     return Array.from(map.entries()).map(([bias, s]) => ({
        bias,
        count: s.count,
        avgRisk: (s.sumRisk / s.count).toFixed(2)
     })).sort((a,b) => b.count - a.count);
  });

  ngOnInit() {
    this.refresh();
  }

  async refresh() {
    try {
      const res = await fetch("/api/journal");
      const text = await res.text();
      if (text.includes("Rate exceeded")) {
         console.warn("Rate limit hit fetching journal, ignoring for now...");
         return;
      }
      if (!res.ok) {
         throw new Error(`Server returned ${res.status}`);
      }
      const data = JSON.parse(text);
      this.entries.set(data);
    } catch (e) {
      console.error("Failed to load journal for analytics", e);
    }
  }

  getBiasDot(bias: string): string {
    const b = bias.toLowerCase();
    if (b.includes("bull") || b.includes("long")) return "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
    if (b.includes("bear") || b.includes("short")) return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]";
    return "bg-gray-500";
  }

  getBiasClass(bias: string | undefined): string {
    if (!bias) return "bg-gray-800 text-gray-500 border-gray-700";
    const b = bias.toLowerCase();
    if (b.includes("bull") || b.includes("long")) return "bg-green-500/10 text-green-400 border-green-500/30";
    if (b.includes("bear") || b.includes("short")) return "bg-red-500/10 text-red-400 border-red-500/30";
    return "bg-gray-800 text-gray-300 border-gray-600";
  }
}
