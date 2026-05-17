import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';

export type OpsMode = 'PAPER' | 'TESTNET' | 'LIVE';

@Component({
  selector: 'app-trading-ops-toolbar',
  templateUrl: './trading-ops-toolbar.component.html',
  styleUrls: ['./trading-ops-toolbar.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class TradingOpsToolbarComponent {
  @Input() mode: OpsMode = 'PAPER';
  @Input() killSwitchArmed = false;
  @Input() connected = false;
  @Input() lastSync: string | null = null;

  @Output() modeChange = new EventEmitter<OpsMode>();
  @Output() armKillSwitch = new EventEmitter<void>();
  @Output() disarmKillSwitch = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
}
