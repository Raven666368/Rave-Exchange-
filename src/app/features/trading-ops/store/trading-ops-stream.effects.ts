import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, tap } from 'rxjs';
import { BotStreamService } from '../../../core/bot/bot-stream.service';
import { BotSignalDto } from '../../../core/bot/bot.models';
import * as OpsActions from './trading-ops-ops.actions';

@Injectable()
export class TradingOpsStreamEffects {
  private readonly actions$ = inject(Actions);
  private readonly stream = inject(BotStreamService);
  private readonly platformId = inject(PLATFORM_ID);

  connectStream$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(OpsActions.loadBotStatusSuccess),
        tap(() => {
          if (isPlatformBrowser(this.platformId)) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/bot`;
            this.stream.connect(wsUrl);
          }
        })
      ),
    { dispatch: false }
  );

  signalTap$ = createEffect(
    () =>
      this.stream.messages$.pipe(
        tap(message => {
          if (message.type === 'signal') {
            const signal = message.payload as BotSignalDto;
            void signal;
          }
        })
      ),
    { dispatch: false }
  );

  connectionStatus$ = createEffect(() =>
    this.stream.connectionStatus$.pipe(
      map(connected => OpsActions.setConnectionStatus({ connected }))
    )
  );
}
