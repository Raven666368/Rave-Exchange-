import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-stress-simulation',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] text-gray-300 font-mono overflow-auto">
      <div class="px-6 py-4 border-b border-[#1e222d] flex justify-between items-center bg-[#131722] shrink-0 shadow-md z-10">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
            <mat-icon>pest_control</mat-icon>
          </div>
          <div>
            <h2 class="text-white font-bold tracking-tight text-lg leading-tight uppercase font-sans">Stress Simulation Engine</h2>
            <div class="text-[10px] text-gray-500 uppercase tracking-widest">Monte Carlo Strategy Analysis & Drift Matrix</div>
          </div>
        </div>
        
        <div class="flex items-center gap-4">
           @if (status() !== 'RUNNING') {
             <button class="bg-orange-600 hover:bg-orange-500 text-white px-6 py-1.5 rounded font-bold transition flex items-center gap-2 shadow-lg shadow-orange-500/20" (click)="startSimulation()">
               <mat-icon style="font-size: 16px; width: 16px; height: 16px;">bolt</mat-icon>
               START 10,000x SIM
             </button>
           } @else {
             <button class="bg-red-600 hover:bg-red-500 text-white px-6 py-1.5 rounded font-bold transition flex items-center gap-2 shadow-lg shadow-red-500/20" (click)="stopSimulation()">
               <mat-icon style="font-size: 16px; width: 16px; height: 16px;">stop</mat-icon>
               ABORT
             </button>
           }
        </div>
      </div>

      <div class="flex-1 p-6 flex flex-col lg:flex-row gap-6 bg-[linear-gradient(to_bottom,transparent,#0b0e14_100%),radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(249,115,22,0.05),transparent)]">
        
        <!-- Simulation Settings -->
        <div class="w-full lg:w-1/3 flex flex-col gap-6">
           <div class="bg-[#131722] border border-[#1e222d] rounded-xl shadow-lg relative overflow-hidden flex flex-col">
             <div class="bg-[#1e222d] px-4 py-3 text-xs font-bold text-gray-400 border-b border-[#363c4e] uppercase flex justify-between">
                <span>Adversarial Conditions</span>
             </div>
             <div class="p-4 space-y-4">
                <div class="space-y-1">
                   <label class="text-[10px] text-gray-500 uppercase tracking-widest">Slippage Range (%)</label>
                   <input type="range" min="0" max="5" step="0.1" [(ngModel)]="slipMax" class="w-full accent-orange-500" />
                   <div class="text-xs text-orange-400 text-right">{{ slipMax }}% variance</div>
                </div>
                <div class="space-y-1">
                   <label class="text-[10px] text-gray-500 uppercase tracking-widest">Network Latency Inject (ms)</label>
                   <input type="range" min="50" max="5000" step="50" [(ngModel)]="latencyMax" class="w-full accent-orange-500" />
                   <div class="text-xs text-orange-400 text-right">{{ latencyMax }}ms delay added</div>
                </div>
                <div class="space-y-1">
                   <label class="text-[10px] text-gray-500 uppercase tracking-widest">CME Gap Frequency Shift</label>
                   <input type="range" min="0" max="1" step="0.1" [(ngModel)]="cmeShift" class="w-full accent-orange-500" />
                   <div class="text-xs text-orange-400 text-right">+{{ cmeShift }} modifier</div>
                </div>
                <div class="space-y-1">
                   <label class="text-[10px] text-gray-500 uppercase tracking-widest">Market Feed Drop Rate (%)</label>
                   <input type="range" min="0" max="25" step="1" [(ngModel)]="dropRate" class="w-full accent-orange-500" />
                   <div class="text-xs text-orange-400 text-right">{{ dropRate }}% pack loss</div>
                </div>
             </div>
           </div>
           
           <div class="bg-[#131722] border border-[#1e222d] rounded-xl shadow-lg p-5 flex-1 relative overflow-hidden group border-orange-500/20">
               <h3 class="text-xs font-bold text-orange-400 uppercase mb-2">Simulation Log</h3>
               <div class="text-[10px] font-mono text-gray-500 space-y-1 h-32 overflow-hidden flex flex-col justify-end">
                 @for (log of simLogs(); track $index) {
                    <div [class.text-green-500]="log.includes('WIN')" [class.text-red-500]="log.includes('LOSS')">{{ log }}</div>
                 }
               </div>
           </div>
        </div>
        
        <!-- Output Matrix -->
        <div class="w-full lg:w-2/3 flex flex-col bg-[#131722] border border-[#1e222d] rounded-xl shadow-lg overflow-hidden">
           <div class="bg-[#1e222d] px-4 py-3 text-xs font-bold text-gray-400 border-b border-[#363c4e] uppercase flex justify-between">
             <span>Simulation Telemetry Matrix</span>
             <span class="text-orange-400" [class.animate-pulse]="status() === 'RUNNING'">{{ pathsCompleted() }} / {{ totalPaths }} PATHS</span>
           </div>

           <div class="flex-1 p-6 relative">
              @if (status() === 'IDLE') {
                <div class="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                   <mat-icon class="text-4xl mb-4 opacity-50">auto_graph</mat-icon>
                   <div class="text-sm">INJECT ADVERSARIAL METRICS</div>
                   <div class="text-xs opacity-50 mt-1">Ready to run high-speed Monte Carlo.</div>
                </div>
              } @else {
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                   <div class="bg-[#0b0e14] p-4 rounded border border-[#1e222d]">
                      <div class="text-[10px] text-gray-500 mb-1">PROFIT FACTOR</div>
                      <div class="text-lg font-bold" [class.text-green-400]="profitFactor() > 1" [class.text-red-400]="profitFactor() <= 1">{{ profitFactor() | number:'1.2-2' }}</div>
                   </div>
                   <div class="bg-[#0b0e14] p-4 rounded border border-[#1e222d]">
                      <div class="text-[10px] text-gray-500 mb-1">SHARPE RATIO</div>
                      <div class="text-lg font-bold" [class.text-green-400]="sharpe() > 1.5" [class.text-gray-300]="sharpe() <= 1.5">{{ sharpe() | number:'1.2-2' }}</div>
                   </div>
                   <div class="bg-[#0b0e14] p-4 rounded border border-[#1e222d]">
                      <div class="text-[10px] text-gray-500 mb-1">MAX DRAWDOWN</div>
                      <div class="text-lg font-bold text-red-500">{{ maxDrawdown() | number:'1.1-1' }}%</div>
                   </div>
                   <div class="bg-[#0b0e14] p-4 rounded border border-[#1e222d]">
                      <div class="text-[10px] text-gray-500 mb-1">EXPECTANCY</div>
                      <div class="text-lg font-bold text-yellow-500">{{ expectancy() | number:'1.2-2' }} R</div>
                   </div>
                </div>
                
                <div class="mt-4 pt-4 border-t border-[#1e222d] flex flex-col h-48">
                  <div class="text-xs text-gray-500 mb-2">EQUITY CURVE DEVIATION CASCADES (Mock Visual)</div>
                  <div class="flex-1 border-b border-l border-[#363c4e] flex items-end relative overflow-hidden bg-[rgba(255,255,255,0.01)] p-2">
                     <!-- generative lines based on random completion -->
                     @for (h of simulatedHeights(); track $index) {
                       <div class="flex-1 bg-orange-500 mx-[1px] opacity-20" [class.opacity-80]="$index % 10 === 0" [style.height.%]="h"></div>
                     }
                  </div>
                </div>
              }
           </div>
        </div>
      </div>
    </div>
  `
})
export class StressSimulationComponent {
  status = signal<'IDLE' | 'RUNNING' | 'COMPLETED'>('IDLE');
  pathsCompleted = signal(0);
  totalPaths = 10000;
  
  slipMax = 1.0;
  latencyMax = 200;
  cmeShift = 0.2;
  dropRate = 3;

  profitFactor = signal(1.45);
  sharpe = signal(1.2);
  maxDrawdown = signal(12.5);
  expectancy = signal(0.85);

  simLogs = signal<string[]>([]);
  simulatedHeights = signal<number[]>([]);

  private simInterval: any;

  startSimulation() {
    this.status.set('RUNNING');
    this.pathsCompleted.set(0);
    this.simLogs.set(['[ENGINE] Initialization sequence triggered']);
    
    // We generate 100 heights for the mock visual
    this.simulatedHeights.set(Array(100).fill(50));

    const pfBase = 1.8;
    const ddBase = 5.0;

    this.simInterval = setInterval(() => {
       const p = this.pathsCompleted();
       if (p >= this.totalPaths) {
         this.stopSimulation();
         this.status.set('COMPLETED');
         this.simLogs.update(l => [...l.slice(-4), '[ENGINE] Monte Carlo completed successfully']);
         return;
       }

       const jump = 100 + Math.floor(Math.random() * 400); // multiple paths evaluated concurrently
       const next = Math.min(p + jump, this.totalPaths);
       this.pathsCompleted.set(next);

       // Corrupt stats based on adversarials
       const penalty = (this.slipMax * 0.1) + (this.latencyMax * 0.001) + (this.dropRate * 0.05);
       
       this.profitFactor.set(Math.max(0.2, pfBase - penalty + (Math.random()*0.2 - 0.1)));
       this.maxDrawdown.set(Math.min(100, ddBase + penalty * 5 + Math.random() * 2));
       this.sharpe.set(Math.max(-1, 1.8 - penalty + (Math.random()*0.3)));
       this.expectancy.set(Math.max(-1, 1.2 - penalty*0.5));

       // Log strings
       const isWin = Math.random() > (penalty / 5);
       this.simLogs.update(l => [
          ...l.slice(-4), 
          `[EVAL ${next}] Path vector variance: ${isWin ? 'WIN' : 'LOSS'} (Slippage: ${(Math.random() * this.slipMax).toFixed(2)}%)`
       ]);

       // Update chart
       this.simulatedHeights.update(arr => {
         const last = arr[arr.length - 1];
         const val = isWin ? last + (Math.random()*3) : last - (Math.random()*4);
         const bounded = Math.max(10, Math.min(90, val));
         return [...arr.slice(1), bounded];
       });

    }, 30);
  }

  stopSimulation() {
    if (this.simInterval) clearInterval(this.simInterval);
    if (this.status() === 'RUNNING') {
       this.status.set('IDLE');
       this.simLogs.set([]);
    }
  }
}
