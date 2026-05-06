import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { selectOpsBadgeVm } from '../../features/trading-ops/store/trading-ops-ops.selectors';
import { selectMobileDrawerOpen } from './store/app-shell.selectors';
import * as AppShellActions from './store/app-shell.actions';
import { SwipeCloseDirective } from './directives/swipe-close.directive';
import { TradingOpsDebugBadgeComponent } from '../../features/trading-ops/components/trading-ops-debug-badge/trading-ops-debug-badge.component';
import { OpsMode } from '../../features/trading-ops/components/trading-ops-toolbar/trading-ops-toolbar.component';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-shell',
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, RouterModule, SwipeCloseDirective, TradingOpsDebugBadgeComponent]
})
export class AppShellComponent {
  private store = inject(Store);
  opsBadgeVm$: Observable<{
    mode: OpsMode;
    killSwitchArmed: boolean;
    connected: boolean;
    lastSync: string | null;
  }> = this.store.select(selectOpsBadgeVm);
  mobileDrawerOpen$ = this.store.select(selectMobileDrawerOpen);

  openMobileNav() {
    this.store.dispatch(AppShellActions.openMobileDrawer());
  }

  closeMobileNav() {
    this.store.dispatch(AppShellActions.closeMobileDrawer());
  }

  toggleMobileNav() {
    this.store.dispatch(AppShellActions.toggleMobileDrawer());
  }
}
