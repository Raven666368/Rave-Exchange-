import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { HttpClient } from '@angular/common/http';
import { catchError, map, mergeMap, switchMap, of } from 'rxjs';
import * as TradingOpsActions from './trading-ops.actions';
import * as TradingOpsOpsActions from './trading-ops-ops.actions';

@Injectable()
export class TradingOpsEffects {
  private actions$ = inject(Actions);
  private http = inject(HttpClient);

  submitGate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TradingOpsActions.submitGate),
      mergeMap(action =>
        this.http.post(`/api/trading-ops/${action.tab}`, action.payload).pipe(
          map((result: unknown) => TradingOpsActions.submitGateSuccess({ result })),
          catchError(err =>
            of(
              TradingOpsActions.submitGateFailure({
                error: err?.error?.message || 'Request failed'
              })
            )
          )
        )
      )
    )
  );

  requestDepositAddress$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TradingOpsActions.requestDepositAddress),
      mergeMap(action =>
        this.http.post('/api/funds/deposit', {
          coin: action.coin,
          network: action.network
        }).pipe(
          map((result: unknown) =>
            TradingOpsActions.requestDepositAddressSuccess({ result })
          ),
          catchError(err =>
            of(
              TradingOpsActions.requestDepositAddressFailure({
                error: err?.error?.message || 'Failed to prepare deposit address'
              })
            )
          )
        )
      )
    )
  );

  requestWithdrawal$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TradingOpsActions.requestWithdrawal),
      mergeMap(action =>
        this.http.post('/api/funds/withdraw', {
          coin: action.coin,
          network: action.network,
          address: action.address,
          amount: action.amount
        }).pipe(
          map((result: unknown) =>
            TradingOpsActions.requestWithdrawalSuccess({ result })
          ),
          catchError(err =>
            of(
              TradingOpsActions.requestWithdrawalFailure({
                error: err?.error?.message || 'Withdrawal request failed'
              })
            )
          )
        )
      )
    )
  );

  submitManualTrade$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TradingOpsActions.submitManualTrade),
      switchMap(({ side, symbol }) =>
        this.http.post<{ orderId: string }>('/api/trade/execute', { side, symbol }).pipe(
          map(response =>
            TradingOpsActions.submitManualTradeSuccess({
              orderId: response.orderId,
              side,
              symbol
            })
          ),
          catchError(error =>
            of(
              TradingOpsActions.submitManualTradeFailure({
                error: error?.error?.detail ?? error?.message ?? 'Failed to submit trade'
              })
            )
          )
        )
      )
    )
  );

  submitManualTradeSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TradingOpsActions.submitManualTradeSuccess),
      map(() =>
        TradingOpsOpsActions.touchOpsSync({
          lastSync: new Date().toISOString()
        })
      )
    )
  );

  submitManualTradeFailure$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TradingOpsActions.submitManualTradeFailure),
      map(() =>
        TradingOpsActions.resetManualTradeUi()
      )
    )
  );
}
