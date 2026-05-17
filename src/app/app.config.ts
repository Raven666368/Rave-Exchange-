import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  importProvidersFrom,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withFetch} from '@angular/common/http';
import {provideClientHydration} from '@angular/platform-browser';
import {StoreModule} from '@ngrx/store';
import {EffectsModule} from '@ngrx/effects';
import {StoreDevtoolsModule} from '@ngrx/store-devtools';

import {routes} from './app.routes';
import { metaReducers, initTradingOpsState } from './store/local-storage.meta-reducer';
import { appShellReducer } from './layouts/app-shell/store/app-shell.reducer';
import { tradingOpsReducer } from './features/trading-ops/store/trading-ops.reducer';
import { tradingOpsOpsReducer } from './features/trading-ops/store/trading-ops-ops.reducer';
import { TradingOpsEffects } from './features/trading-ops/store/trading-ops.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideClientHydration(),
    importProvidersFrom(
      StoreModule.forRoot(
        { appShell: appShellReducer, tradingOps: tradingOpsReducer, tradingOpsOpsState: tradingOpsOpsReducer },
        {
          metaReducers,
          initialState: initTradingOpsState(),
          runtimeChecks: {
            strictStateImmutability: true,
            strictActionImmutability: true
          }
        }
      ),
      EffectsModule.forRoot([TradingOpsEffects]),
      StoreDevtoolsModule.instrument({ maxAge: 25, logOnly: false })
    )
  ],
};
