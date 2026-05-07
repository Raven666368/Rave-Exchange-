export type TradingOpsTab = 'sessions' | 'validation' | 'execution' | 'journal' | 'alerts' | 'traces';

export interface TradingOpsVm {
  activeTab: TradingOpsTab;
  loading: boolean;
  error: string | null;
  result: { message?: string } | null;
}
