import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { selectTradingOpsVm } from '../store/trading-ops.selectors';
import * as TradingOpsActions from '../store/trading-ops.actions';
import * as OpsActions from '../store/trading-ops-ops.actions';
import { TradingOpsVm, TradingOpsTab } from '../store/trading-ops.models';
import { BotMode } from '../../../core/bot/bot.models';

@Injectable({ providedIn: 'root' })
export class TradingOpsFacade {
  private readonly store = inject(Store);
  readonly vm$: Observable<TradingOpsVm> = this.store.select(selectTradingOpsVm);

  setActiveTab(activeTab: TradingOpsTab): void {
    this.store.dispatch(TradingOpsActions.setActiveTab({ activeTab }));
  }

  submitGate(tab: TradingOpsTab, payload: unknown): void {
    this.store.dispatch(TradingOpsActions.submitGate({ tab, payload }));
  }

  loadBotStatus(): void {
    this.store.dispatch(OpsActions.loadBotStatus());
  }

  setMode(mode: BotMode): void {
    this.store.dispatch(OpsActions.setOpsMode({ mode }));
  }

  armKillSwitch(): void {
    this.store.dispatch(OpsActions.armKillSwitch());
  }

  disarmKillSwitch(): void {
    this.store.dispatch(OpsActions.disarmKillSwitch());
  }

  refreshSync(): void {
    this.store.dispatch(OpsActions.touchOpsSync({ lastSync: new Date().toISOString() }));
  }

  clear(): void {
    this.store.dispatch(TradingOpsActions.clearTradingOpsState());
    this.store.dispatch(OpsActions.resetOpsSettings());
  }
}
