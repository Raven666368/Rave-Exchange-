import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TradingOpsOpsState } from './trading-ops-ops.state';

export const selectTradingOpsOpsState =
  createFeatureSelector<TradingOpsOpsState>('tradingOpsOpsState');

export const selectOpsMode = createSelector(
  selectTradingOpsOpsState,
  state => state?.mode ?? 'PAPER'
);

export const selectKillSwitchArmed = createSelector(
  selectTradingOpsOpsState,
  state => state?.killSwitchArmed ?? false
);

export const selectOpsConnected = createSelector(
  selectTradingOpsOpsState,
  state => state?.connected ?? false
);

export const selectOpsLastSync = createSelector(
  selectTradingOpsOpsState,
  state => state?.lastSync ?? null
);

export const selectOpsBadgeVm = createSelector(
  selectTradingOpsOpsState,
  state => ({
    mode: state?.mode ?? 'PAPER',
    killSwitchArmed: state?.killSwitchArmed ?? false,
    connected: state?.connected ?? false,
    lastSync: state?.lastSync ?? null
  })
);
