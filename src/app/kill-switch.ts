import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-kill-switch',
  standalone: true,
  template: `
    <div class="bg-gradient-to-r from-[#1a0505] to-[#1e222d] p-4 rounded-xl border border-[#ff2244]/50 flex items-center justify-between shadow-[0_0_15px_rgba(255,34,68,0.2)]">
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" [class.bg-[#00ff88]]="state() === 'IDLE'" [class.bg-[#ff2244]]="state() === 'HALTED'" [class.animate-pulse]="state() === 'IDLE'"></div>
        <div>
          <h2 class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Bot State</h2>
          <span class="text-white font-mono font-bold tracking-tight">{{ state() }}</span>
        </div>
      </div>
      <button (click)="confirmKill()" 
              class="px-6 py-2.5 bg-gradient-to-br from-[#ff2244] to-[#990000] text-white font-black uppercase tracking-widest text-sm rounded-lg shadow-[0_0_15px_rgba(255,34,68,0.4)] transition-all hover:scale-105 active:scale-95">
        KILL SWITCH
      </button>
    </div>
  `
})
export class KillSwitch {
  state = signal<'IDLE' | 'HALTED'>('IDLE');

  async confirmKill() {
    if (confirm('CRITICAL: Are you sure you want to halt ALL trading activities?')) {
      try {
        const response = await fetch('/api/killswitch', { method: 'POST' });
        if (response.ok) {
          this.state.set('HALTED');
          console.log('Kill switch triggered successfully');
        } else {
          console.error('Failed to trigger kill switch');
        }
      } catch (error) {
        console.error('Error triggering kill switch:', error);
      }
    }
  }
}
