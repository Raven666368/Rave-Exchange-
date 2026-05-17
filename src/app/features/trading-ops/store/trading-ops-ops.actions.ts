import { createAction, props } from '@ngrx/store';
import { BotMode, BotConfigDto } from '../../../core/bot/bot.models';

export const loadBotStatus = createAction('[Trading Ops API] Load Bot Status');
export const loadBotStatusSuccess = createAction(
  '[Trading Ops API] Load Bot Status Success',
  props<{
    liveTradingEnabled: boolean;
    mode: BotMode;
    killSwitchArmed: boolean;
    connected: boolean;
    lastSync: string | null;
    currentSymbol: string;
    currentPrice: number;
    currentVolume24h: number;
    spread: number;
    riskPct: number;
  }>()
);
export const loadBotStatusFailure = createAction(
  '[Trading Ops API] Load Bot Status Failure',
  props<{ error: string }>()
);

export const setOpsMode = createAction(
  '[Trading Ops] Set Ops Mode',
  props<{ mode: BotMode }>()
);

export const armKillSwitch = createAction('[Trading Ops] Arm Kill Switch');
export const disarmKillSwitch = createAction('[Trading Ops] Disarm Kill Switch');

export const syncConfig = createAction(
  '[Trading Ops] Sync Config',
  props<{ config: BotConfigDto }>()
);

export const setConnectionStatus = createAction(
  '[Trading Ops] Set Connection Status',
  props<{ connected: boolean }>()
);

export const touchOpsSync = createAction(
  '[Trading Ops] Touch Ops Sync',
  props<{ lastSync: string }>()
);

export const resetOpsSettings = createAction('[Trading Ops] Reset Ops Settings');
