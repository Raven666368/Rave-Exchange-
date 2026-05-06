
import { Component, ChangeDetectorRef, OnInit, OnDestroy, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { cmeGapTracker } from "../lib/cme-gap-tracker";
import { CMEGap } from "../lib/ai/types";

@Component({
  selector: "app-cme-monitor",
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-4 shadow-lg animate-in fade-in duration-300">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <mat-icon class="!text-sm text-yellow-500">grid_view</mat-icon>
          CME Gap Monitor
        </h3>
        <span class="text-[8px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20">
          MAGNET ACTIVE
        </span>
      </div>

      <div class="space-y-3">
        @if (unfilledGaps.length === 0) {
          <div class="py-6 text-center">
            <span class="text-[10px] text-gray-500 font-mono italic">No unmitigated CME gaps detected.</span>
          </div>
        } @else {
          @for (gap of unfilledGaps; track gap.createdAt) {
            <div class="bg-[#131722] border border-[#363c4e] rounded-lg p-3 relative overflow-hidden group">
              <!-- Visual Price Indicator -->
              <div class="absolute left-0 top-0 bottom-0 w-1" 
                [ngClass]="gap.direction === 'Bullish' ? 'bg-[#089981]' : 'bg-[#f23645]'"></div>
              
              <div class="flex justify-between items-start mb-2">
                <div>
                  <p class="text-[10px] text-gray-500 uppercase font-bold tracking-tight">CME Friday Close</p>
                  <p class="text-lg font-mono text-white leading-none mt-1">{{ gap.fridayClose | number:'1.0-0' }}</p>
                </div>
                <div class="text-right">
                  <span class="text-[9px] font-mono" [ngClass]="gap.direction === 'Bullish' ? 'text-[#089981]' : 'text-[#f23645]'">
                    {{ gap.direction === 'Bullish' ? 'Bullish Gap' : 'Bearish Gap' }}
                  </span>
                  <p class="text-[8px] text-gray-500 mt-1">{{ gap.gapSizePct | number:'1.0-2' }}% Range</p>
                </div>
              </div>

              <div class="flex items-center justify-between pt-2 border-t border-[#363c4e]/50">
                <div class="flex items-center gap-1.5">
                   <mat-icon class="!text-[10px] text-gray-400">schedule</mat-icon>
                   <span class="text-[9px] text-gray-400 font-mono">{{ gap.createdAt | date:'MMM dd, HH:mm' }}</span>
                </div>
                <div class="flex flex-col items-end">
                   <span class="text-[10px] text-[#2962ff] font-bold">MAGNETIC PULL</span>
                   <div class="w-24 h-1 bg-gray-800 rounded-full mt-1 overflow-hidden">
                      <div class="h-full bg-[#2962ff] animate-pulse" [style.width.%]="proximity(gap)"></div>
                   </div>
                </div>
              </div>
            </div>
          }
        }
      </div>

      <div class="mt-4 pt-3 border-t border-[#363c4e] flex justify-between items-center text-[8px] text-gray-500">
        <span>STRATEGY: GAP FILTRATION</span>
        <span class="flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          REAL-TIME
        </span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
  `]
})
export class CmeMonitorComponent implements OnInit, OnDestroy {
  unfilledGaps: CMEGap[] = [];
  interval: ReturnType<typeof setInterval> | undefined;

  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.update();
    if (typeof window !== "undefined") {
      this.interval = setInterval(() => this.update(), 1000);
    }
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  update() {
    this.unfilledGaps = cmeGapTracker.getOpenGaps();
    this.cdr.detectChanges();
  }

  proximity(gap: CMEGap) {
    const currentPrice = cmeGapTracker.lastSeenPrice();
    const context = cmeGapTracker.getGapContext(currentPrice);
    if (context.nearestGap?.id === gap.id) {
       return context.magneticPull * 100;
    }
    return 0;
  }
}
