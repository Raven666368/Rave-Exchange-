import { Component, ChangeDetectionStrategy, Input } from '@angular/core';
import { OpsMode } from '../trading-ops-toolbar/trading-ops-toolbar.component';

@Component({
  selector: 'app-trading-ops-debug-badge',
  templateUrl: './trading-ops-debug-badge.component.html',
  styleUrls: ['./trading-ops-debug-badge.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class TradingOpsDebugBadgeComponent {
  @Input() mode: OpsMode = 'PAPER';
  @Input() killSwitchArmed = false;
  @Input() lastSync: string | null = null;
  @Input() connected = false;
}
