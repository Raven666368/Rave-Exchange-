export type TradingOpsTab = 'sessions' | 'validation' | 'execution' | 'journal' | 'alerts';

export interface TradingOpsVm {
  activeTab: TradingOpsTab;
  loading: boolean;
  error: string | null;
  result: { message?: string } | null;
}
