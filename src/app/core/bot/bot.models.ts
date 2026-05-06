export type BotMode = 'PAPER' | 'TESTNET' | 'LIVE';

export interface BotStatusDto {
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
}

export interface BotKillSwitchDto {
  armed: boolean;
  updatedAt: string;
}

export interface BotSignalDto {
  id: string;
  ts: string;
  symbol: string;
  side: 'REVERSION_LONG' | 'REVERSION_SHORT' | 'NEUTRAL';
  confidence: number;
  reason: string;
  price?: number;
}

export interface BotConfigDto {
  liveTradingEnabled: boolean;
  riskPct: number;
  apiKeyConfigured: boolean;
}

export interface BotJournalEntryDto {
  id: string;
  ts: string;
  ticker: string;
  action: string;
  price: number;
  size: number;
  sentiment_score: number;
  status: string;
  error_tracing: string | null;
}
