import { OpsMode } from '../components/trading-ops-toolbar/trading-ops-toolbar.component';

export interface TradingOpsOpsState {
  mode: OpsMode;
  killSwitchArmed: boolean;
  connected: boolean;
  lastSync: string | null;
}

export const initialTradingOpsOpsState: TradingOpsOpsState = {
  mode: 'PAPER',
  killSwitchArmed: false,
  connected: true,
  lastSync: null
};
