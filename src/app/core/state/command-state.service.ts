import { Injectable, signal } from '@angular/core';
import { DecisionTraceEvent, ExecutionMetric, StrategyWeightEvent, SystemHealthState, RiskSentinelState, MarketMicrostructureState } from './event-schema';
import { StreamNormalizer } from './stream-normalizer';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'ORDER' | 'EXECUTION' | 'PNL' | 'STRATEGY' | 'SYSTEM' | 'TRACE';
  metadata?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class CommandStateService {
  // Normalized specific collections
  readonly decisionTrace$ = signal<DecisionTraceEvent[]>([]);
  readonly executionAnalytics$ = signal<ExecutionMetric[]>([]);
  readonly strategyWeights$ = signal<StrategyWeightEvent[]>([]);
  readonly systemHealth$ = signal<SystemHealthState | null>(null);
  readonly riskSentinel$ = signal<RiskSentinelState | null>(null);
  readonly marketMicrostructure$ = signal<Record<string, MarketMicrostructureState>>({});

  // Chronological Unified Event Bus (Timeline)
  readonly eventTimeline$ = signal<TimelineEvent[]>([]);
  
  // High-priority state
  readonly brokerStatus$ = signal<'CONNECTED' | 'DISCONNECTED' | 'DEGRADED'>('DISCONNECTED');
  
  // Standard WebSocket state handling
  readonly wsStatus$ = signal<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  
  // Raw streams (optional, for backwards compatibility if needed, but best to deprecate)
  readonly rawOrders$ = signal<Record<string, unknown>[]>([]);
  readonly rawPositions$ = signal<Record<string, unknown>[]>([]);
  readonly rawPnl$ = signal<Record<string, unknown>[]>([]);

  // Rolling Windows Settings
  private readonly MAX_EVENTS = 50;
  private readonly MAX_TIMELINE_EVENTS = 200;

  // Set connect/disconnect status
  setWsStatus(status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED') {
    this.wsStatus$.set(status);
  }
  
  setBrokerStatus(status: 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED') {
    this.brokerStatus$.set(status);
  }

  // Handle incoming generic event from WebSockets or HTTP
  processEvent(eventCode: string, payload: Record<string, unknown>) {
    const timestamp = new Date().toISOString();

    // Route to appropriate normalized store
    switch (eventCode) {
      case 'decision_trace':
        this.addDecisionTrace(payload, timestamp);
        break;
      case 'execution_metric':
        this.addExecutionMetric(payload, timestamp);
        break;
      case 'strategy_weight':
        this.addStrategyWeight(payload, timestamp);
        break;
      case 'system_health':
        this.updateSystemHealth(payload);
        break;
      case 'risk_sentinel':
        this.updateRiskSentinel(payload);
        break;
      case 'market_microstructure':
        this.updateMarketMicrostructure(payload);
        break;
      case 'order_update':
        this.rawOrders$.update(v => [payload, ...v].slice(0, this.MAX_EVENTS));
        this.addToTimeline({
          id: Math.random().toString(36).substring(2, 9),
          timestamp,
          message: `Order ${String(payload['status']) || 'Updated'}: ${String(payload['symbol']) || ''}`,
          type: 'ORDER',
          metadata: payload
        });
        break;
      case 'position_update':
        this.rawPositions$.update(v => [payload, ...v].slice(0, this.MAX_EVENTS));
        break;
      case 'pnl_update':
        this.rawPnl$.update(v => [payload, ...v].slice(0, this.MAX_EVENTS));
        this.addToTimeline({
          id: Math.random().toString(36).substring(2, 9),
          timestamp,
          message: `PnL Update: ${((payload['pnl'] || 0) as number) > 0 ? '+' : ''}${payload['pnl']} USDT`,
          type: 'PNL',
          metadata: payload
        });
        break;
      default:
        // Generic fallback into raw store
        this.rawOrders$.update(orders => [payload, ...orders].slice(0, this.MAX_EVENTS));
        break;
    }
  }

  private addDecisionTrace(payload: Record<string, unknown>, defaultTimestamp: string) {
    const normalized = StreamNormalizer.normalizeDecisionTrace(payload);
    if (!normalized) return;
    if (!normalized.timestamp) normalized.timestamp = defaultTimestamp;
    
    this.decisionTrace$.update(v => [normalized, ...v].slice(0, this.MAX_EVENTS));
    this.addToTimeline({
       id: normalized.id,
       timestamp: normalized.timestamp,
       message: `Decision Arbitration: ${normalized.final_decision} on ${normalized.symbol}`,
       type: 'TRACE',
       metadata: normalized as unknown as Record<string, unknown>
    });
  }

  private addExecutionMetric(payload: Record<string, unknown>, defaultTimestamp: string) {
    const normalized = StreamNormalizer.normalizeExecutionMetric(payload);
    if (!normalized) return;
    if (!normalized.timestamp) normalized.timestamp = defaultTimestamp;

    this.executionAnalytics$.update(v => [normalized, ...v].slice(0, this.MAX_EVENTS));
    this.addToTimeline({
       id: Math.random().toString(36).substring(2, 9),
       timestamp: normalized.timestamp,
       message: `Fill Confirmed: ${normalized.symbol} @ ${normalized.fill} (Slip: ${normalized.slip})`,
       type: 'EXECUTION',
       metadata: normalized as unknown as Record<string, unknown>
    });
  }

  private addStrategyWeight(payload: Record<string, unknown>, defaultTimestamp: string) {
    const normalized = StreamNormalizer.normalizeStrategyWeight(payload);
    if (!normalized) return;
    
    // We update the existing strategy or add a new one, keeping unique
    this.strategyWeights$.update(v => {
       const existingIndex = v.findIndex(s => s.name === normalized.name);
       const next = [...v];
       if (existingIndex >= 0) {
          next[existingIndex] = normalized;
       } else {
          next.push(normalized);
       }
       return next.sort((a,b) => b.weight - a.weight);
    });

    this.addToTimeline({
       id: Math.random().toString(36).substring(2, 9),
       timestamp: defaultTimestamp,
       message: `Strategy Weight Shift: ${normalized.name} -> ${normalized.weight}%`,
       type: 'STRATEGY'
    });
  }

  private updateSystemHealth(payload: Record<string, unknown>) {
    const normalized = StreamNormalizer.normalizeSystemHealth(payload);
    if (!normalized) return;
    this.systemHealth$.set(normalized);
  }

  private updateRiskSentinel(payload: Record<string, unknown>) {
    const normalized = StreamNormalizer.normalizeRiskSentinel(payload);
    if (!normalized) return;
    this.riskSentinel$.set(normalized);
  }

  private updateMarketMicrostructure(payload: Record<string, unknown>) {
    const normalized = StreamNormalizer.normalizeMarketMicrostructure(payload);
    if (!normalized) return;
    this.marketMicrostructure$.update(state => ({
      ...state,
      [normalized.symbol]: normalized
    }));
  }

  private addToTimeline(event: TimelineEvent) {
    this.eventTimeline$.update(v => [event, ...v].slice(0, this.MAX_TIMELINE_EVENTS));
  }
}
