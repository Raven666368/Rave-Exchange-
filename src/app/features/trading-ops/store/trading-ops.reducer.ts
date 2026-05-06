import { createReducer, on } from '@ngrx/store';
import * as TradingOpsActions from './trading-ops.actions';
import { TradingOpsState } from './trading-ops.state';

export const initialState: TradingOpsState = {
  activeTab: 'sessions',
  loading: false,
  error: null,
  result: null,
  submitting: false,
  lastTradeError: null,
  lastTradeId: null
};

export const tradingOpsReducer = createReducer(
  initialState,
  on(TradingOpsActions.setActiveTab, (state, { activeTab }) => ({
    ...state,
    activeTab,
    error: null,
    result: null
  })),
  on(
    TradingOpsActions.submitGate,
    TradingOpsActions.requestDepositAddress,
    TradingOpsActions.requestWithdrawal,
    state => ({ ...state, loading: true, error: null, result: null })
  ),
  on(
    TradingOpsActions.submitGateSuccess,
    TradingOpsActions.requestDepositAddressSuccess,
    TradingOpsActions.requestWithdrawalSuccess,
    (state, { result }) => ({ ...state, loading: false, result })
  ),
  on(
    TradingOpsActions.submitGateFailure,
    TradingOpsActions.requestDepositAddressFailure,
    TradingOpsActions.requestWithdrawalFailure,
    (state, { error }) => ({ ...state, loading: false, error })
  ),
  on(TradingOpsActions.clearTradingOpsState, () => initialState),
  on(TradingOpsActions.submitManualTrade, state => ({
    ...state,
    submitting: true,
    lastTradeError: null
  })),
  on(TradingOpsActions.submitManualTradeSuccess, (state, { orderId }) => ({
    ...state,
    submitting: false,
    lastTradeId: orderId,
    lastTradeError: null
  })),
  on(TradingOpsActions.submitManualTradeFailure, (state, { error }) => ({
    ...state,
    submitting: false,
    lastTradeError: error
  })),
  on(TradingOpsActions.resetManualTradeUi, state => ({
    ...state,
    submitting: false,
    lastTradeError: null
  }))
);