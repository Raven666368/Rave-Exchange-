import { createReducer, on } from '@ngrx/store';
import * as OpsActions from './trading-ops-ops.actions';
import { initialTradingOpsOpsState } from './trading-ops-ops.state';

export const tradingOpsOpsReducer = createReducer(
  initialTradingOpsOpsState,
  on(OpsActions.setOpsMode, (state, { mode }) => ({
    ...state,
    mode,
    lastSync: new Date().toISOString()
  })),
  on(OpsActions.armKillSwitch, state => ({
    ...state,
    killSwitchArmed: true,
    lastSync: new Date().toISOString()
  })),
  on(OpsActions.disarmKillSwitch, state => ({
    ...state,
    killSwitchArmed: false,
    lastSync: new Date().toISOString()
  })),
  on(OpsActions.setConnectionStatus, (state, { connected }) => ({
    ...state,
    connected,
    lastSync: new Date().toISOString()
  })),
  on(OpsActions.touchOpsSync, (state, { lastSync }) => ({
    ...state,
    lastSync
  })),
  on(OpsActions.resetOpsSettings, () => initialTradingOpsOpsState)
);
