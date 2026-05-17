import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type TradingOpsTab = 'sessions' | 'validation' | 'execution' | 'journal' | 'alerts';

export interface TradingOpsState {
  activeTab: TradingOpsTab;
  loading: boolean;
  error: string | null;
  result: { message?: string } | null;
}

@Injectable({ providedIn: 'root' })
export class TradingOpsFacade {
  private http = inject(HttpClient);

  // Native Angular 21 Signal State
  private state = signal<TradingOpsState>({
    activeTab: 'sessions',
    loading: false,
    error: null,
    result: null
  });

  // Selectors (View Model)
  readonly vm = computed(() => this.state());

  setActiveTab(activeTab: TradingOpsTab): void {
    this.state.update(s => ({ ...s, activeTab, error: null, result: null }));
  }

  submitGate(tab: TradingOpsTab, payload: Record<string, unknown>): void {
    this.state.update(s => ({ ...s, loading: true, error: null, result: null }));

    this.http.post(`/api/trading-ops/${tab}`, payload).subscribe({
      next: (res: unknown) => {
        this.state.update(s => ({ ...s, loading: false, result: res as { message?: string } }));
      },
      error: (err: unknown) => {
        const errorObj = err as { error?: { message?: string } };
        this.state.update(s => ({
          ...s,
          loading: false,
          error: errorObj?.error?.message || 'Gate rejected or request failed'
        }));
      }
    });
  }

  clear(): void {
    this.state.set({
      activeTab: 'sessions',
      loading: false,
      error: null,
      result: null
    });
  }
}
