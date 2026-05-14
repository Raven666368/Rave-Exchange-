import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotApiService } from '../../../core/bot/bot-api.service';
import { BotStreamService } from '../../../core/bot/bot-stream.service';
import { DecisionTraceDto } from '../../../core/bot/bot.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-decision-trace-explorer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="trace-wrapper">
      <div class="trace-header">
        <div class="eyebrow">OBSERVABILITY</div>
        <h2>Decision Trace Explorer</h2>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Symbol</th>
              <th>Decision</th>
              <th>Contributors</th>
              <th>Strategy Weights</th>
              <th>PnL Snapshot</th>
            </tr>
          </thead>
          <tbody>
            @for (trace of traces(); track trace.id) {
              <tr [ngClass]="{'row-trade': trace.final_decision === 'BUY' || trace.final_decision === 'SELL'}">
                <td class="td-time">{{ trace.timestamp | date:'shortTime' }}</td>
                <td class="td-ticker">{{ trace.symbol }}</td>
                <td [ngClass]="trace.final_decision === 'N/A' || trace.final_decision === 'SKIP' ? 'decision-skip' : trace.final_decision">{{ trace.final_decision }}</td>
                <td class="json-cell"><pre>{{ trace.contributors | json }}</pre></td>
                <td class="json-cell"><pre>{{ trace.strategy_weights | json }}</pre></td>
                <td>{{ trace.pnl_snapshot | number:'1.2-2' }}</td>
              </tr>
            }
            @if (traces().length === 0) {
              <tr>
                <td colspan="6" style="text-align: center; color: #888; padding: 32px;">No decision traces captured yet.<br/><span style="font-size: 0.75rem">Traces are generated when evaluating multi-gate confluences.</span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .trace-wrapper { padding: 16px; background: rgba(0,0,0,0.4); border-radius: 8px; border: 1px solid var(--border, #333); }
    .trace-header { margin-bottom: 16px; }
    .eyebrow { font-size: 0.75rem; color: #888; letter-spacing: 0.1em; }
    h2 { margin: 4px 0 0; font-size: 1.25rem; font-weight: normal; }
    
    .table-container { overflow-x: auto; max-height: 500px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem; }
    th { border-bottom: 1px solid #333; padding: 8px 12px; color: #aaa; font-weight: 500; position: sticky; top: 0; background: #111; }
    td { padding: 10px 12px; border-bottom: 1px solid #222; vertical-align: top; }
    
    .td-ticker { font-weight: bold; color: #fff; }
    .td-time { color: #888; white-space: nowrap; }
    
    .BUY { font-weight: bold; color: #10b981; }
    .SELL { font-weight: bold; color: #ef4444; }
    .decision-skip { color: #6b7280; font-style: italic; }
    
    .row-trade td { background: rgba(255, 255, 255, 0.03); }
    
    .json-cell pre {
      margin: 0;
      white-space: pre-wrap;
      font-size: 0.7rem;
      color: #93c5fd;
      background: rgba(0,0,0,0.3);
      padding: 4px;
      border-radius: 4px;
      max-height: 100px;
      overflow-y: auto;
    }
  `]
})
export class DecisionTraceExplorerComponent implements OnInit, OnDestroy {
  ws = inject(BotStreamService);
  private readonly apiService = inject(BotApiService);
  private sub = new Subscription();

  traces = signal<DecisionTraceDto[]>([]);

  ngOnInit() {
    this.apiService.getTraces().subscribe((data) => {
      this.traces.set(data);
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws.connect(`${protocol}//${window.location.host}/ws/bot`);

    this.sub.add(
      this.ws.onEvent<DecisionTraceDto>('signal').subscribe(newTrace => {
        this.traces.update((current) => [newTrace, ...current].slice(0, 100));
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }
}
