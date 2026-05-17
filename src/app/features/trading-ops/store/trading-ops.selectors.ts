import { createSelector, createFeatureSelector } from '@ngrx/store';
import { TradingOpsVm } from './trading-ops.models';
import { TradingOpsState } from './trading-ops.state';

export const selectTradingOpsState = createFeatureSelector<TradingOpsState>('tradingOps');

export const selectTradingOpsVm = createSelector(
  selectTradingOpsState,
  (): TradingOpsVm => ({
    activeTab: 'sessions',
    loading: false,
    error: null,
    result: null
  })
);

export const selectTradingOpsSubmitting = createSelector(
  selectTradingOpsState,
  state => state?.submitting || false
);

export const selectTradingOpsLastTradeError = createSelector(
  selectTradingOpsState,
  state => state?.lastTradeError || null
);

export const selectTradingOpsLastTradeId = createSelector(
  selectTradingOpsState,
  state => state?.lastTradeId || null
);
