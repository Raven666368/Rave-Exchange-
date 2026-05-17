import { ActionReducer, MetaReducer, Action } from '@ngrx/store';

export const TRADING_OPS_OPS_KEY = 'tradingOpsOpsState';

export function storageMetaReducer(
  reducer: ActionReducer<unknown, Action>
): ActionReducer<unknown, Action> {
  return function (state, action) {
    const nextState = reducer(state, action);

    if (typeof window !== 'undefined') {
      try {
        const persist = {
          tradingOpsOpsState: (nextState as unknown as { tradingOpsOpsState: unknown })?.tradingOpsOpsState
        };
        localStorage.setItem(TRADING_OPS_OPS_KEY, JSON.stringify(persist));
      } catch (err) {
        console.warn('Could not save state to localStorage', err);
      }
    }

    return nextState;
  };
}

export function initTradingOpsState() {
  if (typeof window === 'undefined') return undefined;

  try {
    const raw = localStorage.getItem(TRADING_OPS_OPS_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw);
    return parsed || undefined;
  } catch {
    return undefined;
  }
}

export const metaReducers: MetaReducer[] = [storageMetaReducer];
