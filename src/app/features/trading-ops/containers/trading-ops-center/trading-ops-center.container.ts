import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TradingOpsFacade } from '../../services/trading-ops.facade';
import { TradingOpsTab } from '../../store/trading-ops.models';
import { OpsMode, TradingOpsToolbarComponent } from '../../components/trading-ops-toolbar/trading-ops-toolbar.component';
import { TradingOpsCenterComponent } from '../../components/trading-ops-center/trading-ops-center.component';
import { App } from '../../../../app';
import { DataStore } from '../../../../data.store';

@Component({
  selector: 'app-trading-ops-center-container',
  templateUrl: './trading-ops-center.container.html',
  styleUrls: ['./trading-ops-center.container.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TradingOpsToolbarComponent, TradingOpsCenterComponent]
})
export class TradingOpsCenterContainerComponent {
  private facade = inject(TradingOpsFacade);
  private fb = inject(FormBuilder);
  
  // Inject App and DataStore for real-time market data
  public appRoot = inject(App, { optional: true });
  public dataStore = inject(DataStore);

  vm$ = this.facade.vm$;

  mode: OpsMode = 'PAPER';
  killSwitchArmed = false;
  connected = true;
  lastSync: string | null = new Date().toLocaleTimeString();

  tabs = [
    { id: 'sessions' as TradingOpsTab, label: 'Sessions' },
    { id: 'validation' as TradingOpsTab, label: 'Validation' },
    { id: 'execution' as TradingOpsTab, label: 'Execution' },
    { id: 'journal' as TradingOpsTab, label: 'Journal' },
    { id: 'traces' as TradingOpsTab, label: 'Observer Traces' },
    { id: 'alerts' as TradingOpsTab, label: 'Alerts' }
  ];

  form = this.fb.group({
    session: ['LONDON', Validators.required],
    symbol: ['GUNUSDT', Validators.required],
    cmeGapChecked: [false],
    fundingChecked: [false],
    rolloverChecked: [false],
    confluenceScore: [0, [Validators.min(0), Validators.max(9)]],
    liquiditySweep: [false],
    mssConfirmed: [false],
    riskAccepted: [false],
    side: ['BUY', Validators.required],
    qty: [0, [Validators.min(0)]],
    orderType: ['MARKET', Validators.required],
    reduceOnly: [false],
    dryRun: [true],
    thesis: [''],
    entryReason: [''],
    exitReason: [''],
    outcome: [''],
    title: [''],
    triggerAt: [''],
    channel: ['IN_APP'],
    enabled: [true]
  });

  setTab(tab: TradingOpsTab) {
    this.facade.setActiveTab(tab);
  }

  setMode(mode: OpsMode) {
    this.mode = mode;
    this.facade.setMode(mode);
    this.lastSync = new Date().toLocaleTimeString();
  }

  armKillSwitch() {
    this.killSwitchArmed = true;
    this.facade.armKillSwitch();
    this.lastSync = new Date().toLocaleTimeString();
  }

  disarmKillSwitch() {
    this.killSwitchArmed = false;
    this.facade.disarmKillSwitch();
    this.lastSync = new Date().toLocaleTimeString();
  }

  refresh() {
    this.facade.refreshSync();
    this.lastSync = new Date().toLocaleTimeString();
  }

  submitGate(activeTab: TradingOpsTab) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.facade.submitGate(activeTab, this.form.value);
  }

  closePanel() {
    this.facade.clear();
    this.killSwitchArmed = false;
    this.mode = 'PAPER';
  }
}
