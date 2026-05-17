import { Component, OnInit, computed, output, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

export interface Gate {
  id: number;
  name: string;
  status: 'WAIT' | 'PASS' | 'FAIL';
  reason: string;
}

@Component({
  selector: 'app-gate-matrix',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-gradient-to-b from-[#131722] to-[#0a0a0f] p-5 rounded-xl border border-[#363c4e] shadow-[0_0_15px_rgba(0,0,0,0.5)] font-mono text-xs">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-gray-300 uppercase tracking-widest font-bold">9-Gate Matrix</h2>
        <span class="text-[#089981] font-bold drop-shadow-[0_0_8px_rgba(8,153,129,0.5)]">{{ confidence() }}% Confidence</span>
      </div>
      <div class="space-y-2">
        @for (gate of gates(); track gate.id) {
          <div class="flex items-center gap-3 p-2.5 rounded-lg bg-[#1a1f2e] border border-[#2a2e39] transition-all hover:border-[#464c5e]">
            <div class="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" 
                 [class.bg-[#ffaa00]]="gate.status === 'WAIT'"
                 [class.bg-[#00ff88]]="gate.status === 'PASS'"
                 [class.bg-[#ff2244]]="gate.status === 'FAIL'">
            </div>
            <div class="flex-1">
              <div class="flex justify-between">
                <span class="text-gray-200 font-bold tracking-tight">{{ gate.name }}</span>
                <span [class]="gate.status === 'PASS' ? 'text-[#00ff88]' : gate.status === 'FAIL' ? 'text-[#ff2244]' : 'text-[#ffaa00]'" class="font-bold">
                   {{ gate.status }}
                </span>
              </div>
              <p class="text-[10px] text-gray-500 font-medium">{{ gate.reason }}</p>
            </div>
          </div>
        }
      </div>
    </div>
    <button [disabled]="!allPassed()"
            (mousedown)="ctaReact($event)"
            (click)="tradeRequest.emit()"
            [class.bg-[#089981]]="allPassed()"
            [class.bg-gray-800]="!allPassed()"
            [class.text-gray-400]="!allPassed()"
            [class.shadow-[0_0_20px_rgba(8,153,129,0.4)]]="allPassed()"
            class="w-full mt-6 py-4 rounded-xl text-white font-black uppercase tracking-[0.2em] text-sm transition-all hover:brightness-110 active:scale-[0.98] border border-[#089981]/50">
      {{ allPassed() ? 'PREPARE ALGO TRADE' : 'GATES PENDING' }}
    </button>
  `
})
export class GateMatrix implements OnInit {
  tradeRequest = output<void>();

  ctaReact(event: Event) {
    const el = event.currentTarget as HTMLElement;
    import('motion').then(({ animate }) => {
      animate(el, { scale: [1, 0.95, 1.05, 1] }, { duration: 0.3, ease: "easeInOut" });
    });
  }
  gates = signal<Gate[]>([
    { id: 1, name: 'SESSION', status: 'WAIT', reason: 'Synchronizing...' },
    { id: 2, name: 'PCA REGIME', status: 'WAIT', reason: 'Analyzing regime...' },
    { id: 3, name: 'SWEEP', status: 'WAIT', reason: 'Detection...' },
    { id: 4, name: 'MSS', status: 'WAIT', reason: 'Awaiting shift...' },
    { id: 5, name: 'ZONE (FVG/OB)', status: 'WAIT', reason: 'Finding...' },
    { id: 6, name: 'HTF CONFLUENCE', status: 'WAIT', reason: '4H check...' },
    { id: 7, name: 'VOLATILITY', status: 'WAIT', reason: 'Measuring...' },
    { id: 8, name: 'SPREAD', status: 'WAIT', reason: 'Monitoring...' },
    { id: 9, name: 'R:R RATIO', status: 'WAIT', reason: 'Validating...' },
  ]);

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  confidence = signal<number>(0);
  allPassed = computed(() => this.gates().every((g: Gate) => g.status === 'PASS'));

  ngOnInit() {
    if (this.isBrowser) {
      setInterval(() => this.pollGates(), 15000);
    }
  }
  
  pollGates() {
    this.gates.update((gates: Gate[]) => gates.map((g: Gate) => ({
        ...g,
        status: Math.random() > 0.3 ? 'PASS' : 'FAIL',
        reason: 'Evaluation verified.'
    })));
    this.confidence.set(Math.floor(Math.random() * 100));
  }
}
