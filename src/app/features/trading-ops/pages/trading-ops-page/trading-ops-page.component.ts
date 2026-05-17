import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingOpsCenterContainerComponent } from '../../containers/trading-ops-center/trading-ops-center.container';

@Component({
  selector: 'app-trading-ops-page',
  standalone: true,
  imports: [CommonModule, TradingOpsCenterContainerComponent],
  templateUrl: './trading-ops-page.component.html',
  styleUrls: ['./trading-ops-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TradingOpsPageComponent {}
