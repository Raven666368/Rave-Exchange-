import { createAction, props } from '@ngrx/store';
import { TradingOpsTab } from './trading-ops.models';

export const setActiveTab = createAction('[Trading Ops] Set Active Tab', props<{ activeTab: TradingOpsTab }>());
export const submitGate = createAction('[Trading Ops] Submit Gate', props<{ tab: TradingOpsTab; payload: unknown }>());
export const submitGateSuccess = createAction('[Trading Ops] Submit Gate Success', props<{ result: unknown }>());
export const submitGateFailure = createAction('[Trading Ops] Submit Gate Failure', props<{ error: string }>());

export const requestDepositAddress = createAction('[Trading Ops] Request Deposit Address', props<{ coin: string; network: string }>());
export const requestDepositAddressSuccess = createAction('[Trading Ops] Request Deposit Address Success', props<{ result: unknown }>());
export const requestDepositAddressFailure = createAction('[Trading Ops] Request Deposit Address Failure', props<{ error: string }>());

export const requestWithdrawal = createAction('[Trading Ops] Request Withdrawal', props<{ coin: string; network: string; address: string; amount: number }>());
export const requestWithdrawalSuccess = createAction('[Trading Ops] Request Withdrawal Success', props<{ result: unknown }>());
export const requestWithdrawalFailure = createAction('[Trading Ops] Request Withdrawal Failure', props<{ error: string }>());

export const clearTradingOpsState = createAction('[Trading Ops] Clear State');

export const submitManualTrade = createAction(
  '[Trading Ops] Submit Manual Trade',
  props<{ side: 'LONG' | 'SHORT'; symbol: string }>()
);

export const submitManualTradeSuccess = createAction(
  '[Trading Ops API] Submit Manual Trade Success',
  props<{ orderId: string; side: 'LONG' | 'SHORT'; symbol: string }>()
);

export const submitManualTradeFailure = createAction(
  '[Trading Ops API] Submit Manual Trade Failure',
  props<{ error: string }>()
);

export const resetManualTradeUi = createAction(
  '[Trading Ops] Reset Manual Trade UI'
);
