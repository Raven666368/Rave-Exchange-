import { Component, input, signal, OnInit, OnDestroy, effect, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, PercentPipe, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-funding-rate',
  standalone: true,
  imports: [CommonModule, PercentPipe],
  template: `
    <div class="bg-gradient-to-b from-[#131722] to-[#0a0a0f] p-5 rounded-xl border border-[#363c4e] shadow-lg font-mono">
      <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Funding Rate</h2>
      <div class="text-2xl font-bold" [class]="rate() >= 0 ? 'text-[#00ff88]' : 'text-[#ff2244]'">
        {{ rate() | percent:'1.4-4' }}
      </div>
    </div>
  `
})
export class FundingRate implements OnInit, OnDestroy {
  symbol = input.required<string>();
  rate = signal<number>(0);
  private platformId = inject(PLATFORM_ID);

  constructor() {
      effect(() => {
          this.symbol();
          this.fetchRate();
      });
  }

  ngOnInit() {
    this.fetchRate();
    if (isPlatformBrowser(this.platformId)) {
      this.intervalId = setInterval(() => this.fetchRate(), 300000); // Poll every 5 minutes
    }
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  private intervalId: ReturnType<typeof setInterval> | null = null;

  async fetchRate() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      // Temporarily mock it, since there is no backend route for this yet, 
      // but without spamming the console!
      if (window.location.hostname === 'localhost' || window.location.hostname.includes('ais-dev')) {
        this.rate.set(0.0001); // Mocked rate
        return;
      }
      const res = await fetch(`/api/funding/${this.symbol()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch funding rate: ${res.status}`);
      }
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Invalid JSON response:', e);
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
      if (data.fundingRate) {
        this.rate.set(parseFloat(data.fundingRate));
      }
    } catch(e) { console.error(e); }
  }
}
