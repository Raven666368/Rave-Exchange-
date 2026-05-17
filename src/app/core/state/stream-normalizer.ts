import { DecisionTraceEvent, ExecutionMetric, StrategyWeightEvent, SystemHealthState, RiskSentinelState, MarketMicrostructureState } from './event-schema';

export class StreamNormalizer {
  static normalizeDecisionTrace(raw: Record<string, unknown>): DecisionTraceEvent | null {
    if (!raw) return null;
    return {
      id: String(raw['traceId'] || raw['id'] || Math.floor(Math.random() * 100000)),
      timestamp: String(raw['timestamp'] || new Date().toISOString()),
      symbol: String(raw['symbol'] || 'UNKNOWN'),
      final_decision: (raw['decision'] || raw['final_decision'] || 'NEUTRAL') as 'BUY' | 'SELL' | 'NEUTRAL',
      scores: (raw['scores'] || raw['arbitrationScore'] || { BUY: 0, SELL: 0 }) as { BUY: number; SELL: number; [key: string]: number },
      contributors: Array.isArray(raw['contributors']) ? (raw['contributors'] as unknown[]).map(c => typeof c === 'string' ? c : (c as Record<string, unknown>)['name'] ? String((c as Record<string, unknown>)['name']) : JSON.stringify(c)) : []
    };
  }

  static normalizeExecutionMetric(raw: Record<string, unknown>): ExecutionMetric | null {
    if (!raw) return null;
    return {
      symbol: String(raw['symbol'] || 'UNKNOWN'),
      intent: Number(raw['intent']) || 0,
      fill: Number(raw['fill']) || 0,
      slip: Number(raw['slip']) || 0,
      latency: Number(raw['latency']) || 0,
      timestamp: String(raw['timestamp'] || new Date().toISOString())
    };
  }

  static normalizeStrategyWeight(raw: Record<string, unknown>): StrategyWeightEvent | null {
     if (!raw) return null;
     return {
        name: String(raw['name'] || 'Unknown Strategy'),
        weight: Number(raw['weight']) || 0
     };
  }

  static normalizeSystemHealth(raw: Record<string, unknown>): SystemHealthState | null {
      if (!raw) return null;
      return {
          redisStreams: (raw['redisStreams'] || { lag: 0, throughput: 0, status: 'UNKNOWN' }) as SystemHealthState['redisStreams'],
          workers: (raw['workers'] || { alive: 0, total: 0, avgLatency: 0 }) as SystemHealthState['workers'],
          broker: (raw['broker'] || { latency: 0, status: 'UNKNOWN', capacityUtilization: 0 }) as SystemHealthState['broker'],
          aiCluster: (raw['aiCluster'] || { activeStrategies: 0, suppressed: 0, confidenceSpread: [] }) as SystemHealthState['aiCluster']
      };
  }

  static normalizeRiskSentinel(raw: Record<string, unknown>): RiskSentinelState | null {
      if (!raw) return null;
      return {
          status: (raw['status'] as RiskSentinelState['status']) || 'NORMAL',
          activeTripwires: Array.isArray(raw['activeTripwires']) ? raw['activeTripwires'] as {level: string; message: string}[] : [],
          automatedActions: Array.isArray(raw['automatedActions']) ? raw['automatedActions'] as string[] : [],
          metrics: (raw['metrics'] as RiskSentinelState['metrics']) || { drawdown: 0, latency: 0, slippageScore: 0, strategyCoherence: 1 }
      };
  }

  static normalizeMarketMicrostructure(raw: Record<string, unknown>): MarketMicrostructureState | null {
      if (!raw || !raw['symbol']) return null;
      return {
          symbol: String(raw['symbol']),
          imbalance: Number(raw['imbalance']) || 0,
          spread: Number(raw['spread']) || 0,
          depth_score: Number(raw['depth_score']) || 0,
          sweep_detected: Boolean(raw['sweep_detected']),
          depth_collapse: Boolean(raw['depth_collapse']),
          exchange_divergence: Number(raw['exchange_divergence']) || 0,
          best_bid: Number(raw['best_bid']) || 0,
          best_ask: Number(raw['best_ask']) || 0
      };
  }
}
