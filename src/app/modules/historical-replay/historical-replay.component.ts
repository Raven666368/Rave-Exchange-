import { Component, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { HistoricalReplayService, ReplayState } from '../../core/state/historical-replay.service';

@Component({
  selector: 'app-historical-replay',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, DatePipe],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] text-gray-300 font-mono">
      <div class="px-6 py-4 border-b border-[#1e222d] flex justify-between items-center bg-[#131722] shrink-0 shadow-md z-10">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <mat-icon>history</mat-icon>
          </div>
          <div>
            <h2 class="text-white font-bold tracking-tight text-lg leading-tight uppercase font-sans">Historical Replay Explorer</h2>
            <div class="text-[10px] text-gray-500 uppercase tracking-widest">Time-Travel Engine & Postgres Persistent Store</div>
          </div>
        </div>
        <div class="flex items-center gap-4">
           <div class="flex items-center gap-2 px-3 py-1.5 bg-[#1e222d] border border-[#363c4e] rounded">
              <span class="text-xs text-gray-500">SESSION ID:</span>
              <input type="text" [(ngModel)]="sessionId" placeholder="Enter session id" class="bg-transparent border-none text-white text-sm outline-none w-32 uppercase" />
           </div>
           
           <div class="flex items-center gap-2 px-3 py-1.5 bg-[#1e222d] border border-[#363c4e] rounded">
              <span class="text-xs text-gray-500">SPEED (ms):</span>
              <input type="number" [(ngModel)]="speedMs" class="bg-transparent border-none text-yellow-400 text-sm outline-none w-20" />
           </div>

           @if (replayState().status !== 'PLAYING') {
             <button class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-1.5 rounded font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-500/20" (click)="startReplay()">
               <mat-icon style="font-size: 16px; width: 16px; height: 16px;">play_arrow</mat-icon>
               START
             </button>
           } @else {
             <button class="bg-red-600 hover:bg-red-500 text-white px-6 py-1.5 rounded font-bold transition flex items-center gap-2 shadow-lg shadow-red-500/20" (click)="stopReplay()">
               <mat-icon style="font-size: 16px; width: 16px; height: 16px;">stop</mat-icon>
               STOP
             </button>
           }
        </div>
      </div>

      <!-- Scrubber Track -->
      <div class="bg-[#1e222d] border-b border-[#363c4e] p-4 shrink-0">
         <div class="flex justify-between items-center mb-2">
            <span class="text-xs font-bold text-gray-400">PLAYHEAD STATUS: <span [class.text-indigo-400]="replayState().status === 'PLAYING'" [class.text-green-400]="replayState().status === 'COMPLETED'">{{ replayState().status }}</span></span>
            <span class="text-xs text-gray-500">{{ replayState().eventsProcessed }} / {{ replayState().totalEvents > 0 ? replayState().totalEvents : '?' }} EVENTS</span>
         </div>
         <div class="h-2 w-full bg-[#131722] border border-[#363c4e] rounded-full overflow-hidden relative">
            <div class="h-full bg-indigo-500 transition-all duration-300 relative shadow-[0_0_10px_rgba(99,102,241,0.5)]" [style.width.%]="replayState().progress">
              <div class="absolute right-0 top-0 bottom-0 w-1 bg-white opacity-50"></div>
            </div>
         </div>
      </div>

      <!-- Content Area -->
      <div class="flex-1 p-6 overflow-hidden flex gap-6 bg-[linear-gradient(to_bottom,transparent,#0b0e14_100%),radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(99,102,241,0.05),transparent)]">
         
         <!-- Timeline Event View -->
         <div class="w-2/3 flex flex-col bg-[#131722] border border-[#1e222d] rounded-xl shadow-lg relative overflow-hidden">
           <div class="bg-[#1e222d] px-4 py-3 text-xs font-bold text-gray-400 border-b border-[#363c4e] uppercase flex justify-between">
              <span>Extracted Event Telemetry</span>
              <span class="text-indigo-400 flex items-center gap-1"><mat-icon style="font-size: 14px; width: 14px; height: 14px;">visibility</mat-icon> LIVE TV</span>
           </div>
           
           <div class="p-6 flex-1 overflow-y-auto">
             @if (replayState().currentEvent) {
               <div class="animate-in slide-in-from-bottom-2 duration-300">
                  <div class="text-sm border-l-4 border-indigo-500 pl-4 py-2 bg-indigo-500/5 mb-4">
                     <div class="text-xs text-gray-500 mb-1">{{ getEventField('created_at') | date:'mediumTime' }} <span class="mx-2">|</span> SYMBOL: <span class="text-white font-bold">{{ getEventField('symbol') || 'UNKNOWN' }}</span></div>
                     <div class="text-lg text-white font-sans">{{ getEventField('veto_reason') || 'No narrative recorded.' }}</div>
                  </div>

                  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                     <div class="bg-[#1e222d] p-3 rounded border border-[#363c4e]">
                        <div class="text-[10px] text-gray-500 mb-1">SIDE</div>
                        <div class="text-sm font-bold" [class.text-green-400]="getEventField('side') === 'BUY'" [class.text-red-400]="getEventField('side') === 'SELL'">{{ getEventField('side') || '--' }}</div>
                     </div>
                     <div class="bg-[#1e222d] p-3 rounded border border-[#363c4e]">
                        <div class="text-[10px] text-gray-500 mb-1">QTY</div>
                        <div class="text-sm font-bold text-white">{{ getEventField('qty') || '--' }}</div>
                     </div>
                     <div class="bg-[#1e222d] p-3 rounded border border-[#363c4e]">
                        <div class="text-[10px] text-gray-500 mb-1">FILL PRICE</div>
                        <div class="text-sm font-bold text-white">{{ getEventField('price') || '--' }}</div>
                     </div>
                     <div class="bg-[#1e222d] p-3 rounded border border-[#363c4e]">
                        <div class="text-[10px] text-gray-500 mb-1">STATUS</div>
                        <div class="text-sm font-bold text-yellow-400">{{ getEventField('status') || '--' }}</div>
                     </div>
                  </div>

                  <div class="bg-[#0b0e14] p-4 rounded border border-[#1e222d]">
                     <div class="text-xs text-gray-500 mb-3">RAW PAYLOAD</div>
                     <pre class="text-[10px] text-gray-400 whitespace-pre-wrap">{{ getRawPayload() }}</pre>
                  </div>
               </div>
             } @else if (replayState().status === 'IDLE') {
               <div class="h-full flex flex-col items-center justify-center text-gray-600 text-center">
                 <mat-icon class="text-4xl mb-4 opacity-50">fast_rewind</mat-icon>
                 <div class="text-sm">ENTER SESSION ID AND CLICK START TO REPLAY</div>
                 <div class="text-xs opacity-50 mt-1">Queries Postgres Event Store for Historical Journals</div>
               </div>
             }
           </div>
         </div>

         <!-- Replay Engine Stats -->
         <div class="w-1/3 flex flex-col gap-6">
            <div class="bg-[#131722] border border-[#1e222d] rounded-xl shadow-lg p-5">
               <h3 class="text-xs font-bold text-gray-400 uppercase mb-4 border-b border-[#363c4e] pb-2">Simulation Engine</h3>
               
               <div class="space-y-4">
                 <div>
                   <div class="text-[10px] text-gray-500 mb-1">TICK FREQUENCY</div>
                   <div class="text-sm text-yellow-400 font-bold drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">{{ speedMs }}ms / event</div>
                 </div>
                 
                 <div>
                   <div class="text-[10px] text-gray-500 mb-1">DB CONNECTION</div>
                   <div class="text-sm text-green-400 font-bold flex items-center gap-2">
                     <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     POSTGRES (ACTIVE)
                   </div>
                 </div>

                 <div>
                   <div class="text-[10px] text-gray-500 mb-1">SSE TUNNEL</div>
                   <div class="text-sm text-indigo-400 font-bold" [class.animate-pulse]="replayState().status === 'PLAYING'">
                     {{ replayState().status === 'PLAYING' ? 'STREAMING...' : 'CLOSED' }}
                   </div>
                 </div>
               </div>
            </div>
            
            <div class="bg-[#131722] border border-[#1e222d] rounded-xl shadow-lg p-5 flex-1 relative overflow-hidden group border-indigo-500/20">
               <div class="absolute inset-0 bg-indigo-500/5 transition opacity-0 group-hover:opacity-100"></div>
               <h3 class="text-xs font-bold text-indigo-400 uppercase mb-2">Backtest & Stress Test</h3>
               <p class="text-[10px] text-gray-500 mb-4 leading-relaxed">
                 The Historical Replay Explorer perfectly reconstructs past conditions by replaying journal entries through the exact same UI operational layer that live trading uses. Verify SMC rules, audit missed FVG entries, or find slippage leaks.
               </p>
               <div class="px-3 py-2 bg-[#0b0e14] border border-[#1e222d] rounded text-[10px] text-gray-400">
                 PHASE 6 PREVIEW:<br/>
                 Integrates directly into Stress Simulation Engine to multiply playback speed up to 10,000x for Monte Carlo analysis.
               </div>
            </div>
         </div>
      </div>
    </div>
  `
})
export class HistoricalReplayComponent {
  sessionId: string = 'bridge'; // Default sample session ID
  speedMs: number = 800; // Default playback speed
  
  private replayService = inject(HistoricalReplayService);
  replayState = this.replayService.replayState;

  startReplay() {
    if (!this.sessionId) return;
    this.replayService.startReplay(this.sessionId, this.speedMs);
  }

  stopReplay() {
    this.replayService.stopReplay();
  }

  getEventField(field: string): any {
    const event = this.replayState().currentEvent as Record<string, any>;
    if (!event) return null;
    return event[field];
  }

  getRawPayload(): string {
    return JSON.stringify(this.replayState().currentEvent, null, 2);
  }
}
