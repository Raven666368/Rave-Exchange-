import { TradingOpsTab } from './trading-ops.models';

export interface TradingOpsState {
  activeTab: TradingOpsTab;
  loading: boolean;
  error: string | null;
  result: unknown;
  submitting: boolean;
  lastTradeError: string | null;
  lastTradeId: string | null;
}
