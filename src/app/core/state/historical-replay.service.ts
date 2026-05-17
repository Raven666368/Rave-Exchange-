import { Injectable, signal, inject } from '@angular/core';
import { CommandStateService } from './command-state.service';

export interface ReplayState {
  status: 'IDLE' | 'PLAYING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  progress: number; // 0-100
  currentEvent: unknown | null;
  totalEvents: number;
  eventsProcessed: number;
}

@Injectable({ providedIn: 'root' })
export class HistoricalReplayService {
  private commandState = inject(CommandStateService);

  readonly replayState = signal<ReplayState>({
    status: 'IDLE',
    progress: 0,
    currentEvent: null,
    totalEvents: 0,
    eventsProcessed: 0,
  });

  private eventSource: EventSource | null = null;
  private currentSessionId: string | null = null;
  private currentSpeed = 1000;
  
  // Buffering for pause/play support if needed
  private replayBuffer: unknown[] = [];
  private internalTimer: any = null;

  startReplay(sessionId: string, speedMs = 1000) {
    this.stopReplay();
    this.currentSessionId = sessionId;
    this.currentSpeed = speedMs;
    
    this.replayState.set({
      status: 'PLAYING',
      progress: 0,
      currentEvent: null,
      totalEvents: 0,
      eventsProcessed: 0,
    });

    const isBrowser = typeof window !== 'undefined';
    const baseUrl = isBrowser ? window.location.origin : 'http://localhost:3000';
    
    // We connect to the actual SSE endpoint built in server.ts
    // /api/journal/replay?session_id=...&speed=...
    const url = `${baseUrl}/api/journal/replay?session_id=${sessionId}&speed=${speedMs}`;
    
    try {
      this.eventSource = new EventSource(url);
      
      this.eventSource.addEventListener('start', (e: any) => {
        try {
          const data = JSON.parse(e.data);
          this.replayState.update(s => ({ ...s, totalEvents: data.total || 0 }));
        } catch (err) {}
      });

      this.eventSource.onmessage = (e: any) => {
        try {
          const entry = JSON.parse(e.data);
          this.replayState.update(s => {
             const processed = s.eventsProcessed + 1;
             const progress = s.totalEvents > 0 ? (processed / s.totalEvents) * 100 : 0;
             return {
               ...s,
               currentEvent: entry,
               eventsProcessed: processed,
               progress
             };
          });
          
          // Pipe into the unified operational UI layer 
          this.commandState.processEvent('decision_trace', {
             ...entry,
             decision: entry.side || 'NEUTRAL',
             scores: { BUY: entry.side === 'BUY' ? 1.5 : 0.5, SELL: entry.side === 'SELL' ? 1.5 : 0.5 },
             contributors: [entry.entry_reason || entry.entryReason, entry.vetoReason || entry.veto_reason].filter(Boolean)
          });
          
          if (entry.status && (entry.status.includes('FILLED') || entry.status === 'SENT')) {
             this.commandState.processEvent('execution_metric', {
                ...entry,
                intent: parseFloat(entry.price) || 0,
                fill: parseFloat(entry.price) || 0,
                slip: 0,
                latency: Math.floor(Math.random() * 50) + 10
             });
          }

        } catch(err) {
          console.error("Historical replay parsing error:", err);
        }
      };

      this.eventSource.addEventListener('end', () => {
        this.completeReplay();
      });

      this.eventSource.onerror = (e) => {
        // usually triggers when server ends stream, but let's check readyState
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.completeReplay();
        } else {
          this.replayState.update(s => ({ ...s, status: 'ERROR' }));
          this.stopReplay();
        }
      };

    } catch (e) {
       this.replayState.update(s => ({ ...s, status: 'ERROR' }));
    }
  }

  stopReplay() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.internalTimer) {
      clearInterval(this.internalTimer);
      this.internalTimer = null;
    }
    const s = this.replayState();
    if (s.status === 'PLAYING') {
      this.replayState.update(state => ({ ...state, status: 'IDLE' }));
    }
  }

  completeReplay() {
    this.stopReplay();
    this.replayState.update(s => ({ ...s, status: 'COMPLETED', progress: 100 }));
  }
}
