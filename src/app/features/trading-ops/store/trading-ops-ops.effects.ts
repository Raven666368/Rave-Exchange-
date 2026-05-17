import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { BotApiService } from '../../../core/bot/bot-api.service';
import * as OpsActions from './trading-ops-ops.actions';

@Injectable()
export class TradingOpsOpsEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(BotApiService);

  loadBotStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OpsActions.loadBotStatus),
      switchMap(() =>
        this.api.getStatus().pipe(
          map(status =>
            OpsActions.loadBotStatusSuccess({
              liveTradingEnabled: status.liveTradingEnabled,
              mode: status.mode,
              killSwitchArmed: status.killSwitchArmed,
              connected: status.connected,
              lastSync: status.lastSync,
              currentSymbol: status.currentSymbol,
              currentPrice: status.currentPrice,
              currentVolume24h: status.currentVolume24h,
              spread: status.spread,
              riskPct: status.riskPct
            })
          ),
          catchError(err =>
            of(OpsActions.loadBotStatusFailure({ error: err?.message ?? 'Failed to load bot status' }))
          )
        )
      )
    )
  );

  armKillSwitch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OpsActions.armKillSwitch),
      switchMap(() =>
        this.api.setKillSwitch(true).pipe(
          map(() =>
            OpsActions.touchOpsSync({ lastSync: new Date().toISOString() })
          ),
          catchError(() =>
            of(OpsActions.loadBotStatusFailure({ error: 'Failed to arm kill switch' }))
          )
        )
      )
    )
  );

  disarmKillSwitch$ = createEffect(() =>
    this.actions$.pipe(
      ofType(OpsActions.disarmKillSwitch),
      switchMap(() =>
        this.api.setKillSwitch(false).pipe(
          map(() =>
            OpsActions.touchOpsSync({ lastSync: new Date().toISOString() })
          ),
          catchError(() =>
            of(OpsActions.loadBotStatusFailure({ error: 'Failed to disarm kill switch' }))
          )
        )
      )
    )
  );

  syncConfig$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OpsActions.syncConfig),
        tap(({ config }) => {
          void config;
        })
      ),
    { dispatch: false }
  );
}
