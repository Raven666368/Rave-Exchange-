import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BotStreamService } from '../../../core/bot/bot-stream.service';
import { BotApiService } from '../../../core/bot/bot-api.service';
import { BotJournalEntryDto } from '../../../core/bot/bot.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-bot-journal-grid',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="journal-wrapper">
      <div class="journal-header">
        <div class="eyebrow">MILITARY JOURNAL</div>
        <h2>Trade Log</h2>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Ticker</th>
              <th>Action</th>
              <th>Price</th>
              <th>Size</th>
              <th>Sentiment</th>
              <th>Status</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of entries(); track entry.id) {
              <tr [ngClass]="{ 'row-failed': entry.status === 'Failed', 'row-skipped': entry.status.includes('Skipped') }">
                <td class="td-time">{{ entry.ts | date:'shortTime' }}</td>
                <td class="td-ticker" style="font-family: monospace;">{{ entry.ticker }}</td>
                <td class="td-action" [ngClass]="entry.action">{{ entry.action }}</td>
                <td>{{ entry.price | currency }}</td>
                <td>{{ entry.size }}</td>
                <td>{{ entry.sentiment_score | number:'1.2-2' }}</td>
                <td>
                  <span class="status-badge" [ngClass]="getBadgeClass(entry.status)">
                    {{ entry.status }}
                  </span>
                </td>
                <td class="td-error">{{ entry.error_tracing || '-' }}</td>
              </tr>
            }
            @if (entries().length === 0) {
              <tr>
                <td colspan="8" style="text-align: center; color: #888;">No journal entries yet.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .journal-wrapper { padding: 16px; background: rgba(0,0,0,0.4); border-radius: 8px; border: 1px solid var(--border, #333); }
    .journal-header { margin-bottom: 16px; }
    .eyebrow { font-size: 0.75rem; color: #888; letter-spacing: 0.1em; }
    h2 { margin: 4px 0 0; font-size: 1.25rem; font-weight: normal; }
    
    .table-container { overflow-x: auto; max-height: 400px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; }
    th { border-bottom: 1px solid #333; padding: 8px 12px; color: #aaa; font-weight: 500; position: sticky; top: 0; background: #111; }
    td { padding: 10px 12px; border-bottom: 1px solid #222; }
    
    .td-ticker { font-weight: bold; color: #fff; }
    .LONG { color: #10b981; }
    .SHORT { color: #ef4444; }
    .HOLD { color: #6b7280; }
    .td-error { color: #ef4444; max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .row-failed td { background: rgba(239, 68, 68, 0.05); }
    .row-skipped td { opacity: 0.6; }

    .status-badge {
      padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; text-transform: uppercase;
    }
    .status-badge.executed { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
    .status-badge.failed { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
    .status-badge.skipped { background: rgba(156, 163, 175, 0.2); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.3); }
  `]
})
export class BotJournalGridComponent implements OnInit, OnDestroy {
  ws = inject(BotStreamService);
  private readonly apiService = inject(BotApiService);
  private sub = new Subscription();

  entries = signal<BotJournalEntryDto[]>([]);

  ngOnInit() {
    this.apiService.getJournal().subscribe((history: BotJournalEntryDto[]) => {
      this.entries.set(history);
    });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws.connect(`${protocol}//${window.location.host}/ws/bot`);

    // Listen to real-time events via Socket
    this.sub.add(
      this.ws.onEvent<BotJournalEntryDto>('JOURNAL_ENTRY').subscribe(newEntry => {
        // Prepend the newest entries dynamically to the array signal
        this.entries.update((current) => [newEntry, ...current].slice(0, 50)); 
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  getBadgeClass(status: string) {
    if (status === 'Executed') return 'executed';
    if (status === 'Failed') return 'failed';
    return 'skipped';
  }
}
