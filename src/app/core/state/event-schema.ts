export interface Contributor {
  name: string;
  weight: number;
}

export interface DecisionTraceEvent {
  id: string; // or traceId
  timestamp: string; // or number
  symbol: string;
  final_decision: 'BUY' | 'SELL' | 'NEUTRAL';
  scores: {
    BUY: number;
    SELL: number;
    [key: string]: number;
  };
  contributors: string[]; 
}

export interface StrategyWeightEvent {
  name: string;
  weight: number;
}

export interface ExecutionMetric {
  symbol: string;
  intent: number;
  fill: number;
  slip: number;
  latency: number;
  timestamp: string;
}

export interface SystemHealthState {
  redisStreams: { lag: number; throughput: number; status: string };
  workers: { alive: number; total: number; avgLatency: number };
  broker: { latency: number; status: string; capacityUtilization: number };
  aiCluster: { activeStrategies: number; suppressed: number; confidenceSpread: number[] };
}

export interface RiskSentinelState {
  status: 'NORMAL' | 'WARNING' | 'DEFENSIVE' | 'SHUTDOWN';
  activeTripwires: { level: string; message: string }[];
  automatedActions: string[];
  metrics: {
    drawdown: number;
    latency: number;
    slippageScore: number;
    strategyCoherence: number;
  };
}

export interface MarketMicrostructureState {
  symbol: string;
  imbalance: number;
  spread: number;
  depth_score: number;
  sweep_detected: boolean;
  best_bid: number;
  best_ask: number;
}

export interface StreamEvent {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}
