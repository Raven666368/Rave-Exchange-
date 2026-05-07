import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TradingOpsVm, TradingOpsTab } from '../../store/trading-ops.models';
import { BotJournalGridComponent } from '../bot-journal-grid.component';
import { DecisionTraceExplorerComponent } from '../decision-trace-explorer.component';

@Component({
  selector: 'app-trading-ops-center',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BotJournalGridComponent, DecisionTraceExplorerComponent],
  templateUrl: './trading-ops-center.component.html',
  styleUrls: ['./trading-ops-center.component.css']
})
export class TradingOpsCenterComponent {
  @Input() vm!: TradingOpsVm | null;
  @Input() tabs: { id: TradingOpsTab; label: string }[] = [];
  @Input() form!: FormGroup;

  @Input() currentSymbol = 'BTCUSDT';
  @Input() symbolPrice: number | null = null;
  @Input() currentVolume24h: number | null = null;
  @Input() spread: number | null = null;

  @Output() tabChange = new EventEmitter<TradingOpsTab>();
  @Output() submitGate = new EventEmitter<TradingOpsTab>();
  @Output() closePanel = new EventEmitter<void>();
}
