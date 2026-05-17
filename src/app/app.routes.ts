import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: 'trading-ops',
    loadChildren: () => import('./features/trading-ops/trading-ops.routes').then(m => m.TRADING_OPS_ROUTES)
  },
  { path: '', pathMatch: 'full', redirectTo: 'trading-ops' },
  { path: '**', redirectTo: 'trading-ops' }
];
