import { Injectable } from '@angular/core';
import { Subject, EMPTY, timer } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { catchError, retryWhen, scan, switchMap, takeWhile, tap, filter, map } from 'rxjs/operators';
import { BotSignalDto } from './bot.models';

export interface BotStreamEnvelope {
  type: 'signal' | 'status' | 'pong' | 'error';
  payload: BotSignalDto | unknown;
}

@Injectable({ providedIn: 'root' })
export class BotStreamService {
  private socket$?: WebSocketSubject<BotStreamEnvelope>;
  private readonly messagesSubject = new Subject<BotStreamEnvelope>();
  readonly messages$ = this.messagesSubject.asObservable();

  private readonly connectionSubject = new Subject<boolean>();
  readonly connectionStatus$ = this.connectionSubject.asObservable();

  onEvent<T>(eventType: string) {
    return this.messages$.pipe(
      filter(msg => msg.type === eventType),
      map(msg => msg.payload as T)
    );
  }

  connect(url: string): void {
    if (this.socket$ && !this.socket$.closed) {
      return;
    }

    this.socket$ = webSocket<BotStreamEnvelope>({
      url,
      openObserver: { next: () => this.connectionSubject.next(true) },
      closeObserver: { next: () => this.connectionSubject.next(false) }
    });

    this.socket$
      .pipe(
        tap(msg => this.messagesSubject.next(msg)),
        retryWhen(errors =>
          errors.pipe(
            scan(retryCount => retryCount + 1, 0),
            tap(() => this.connectionSubject.next(false)),
            switchMap(retryCount => timer(Math.min(3000 * retryCount, 15000))),
            takeWhile(retryCount => retryCount < 5)
          )
        ),
        catchError(() => EMPTY)
      )
      .subscribe();
  }

  send(message: BotStreamEnvelope): void {
    this.socket$?.next(message);
  }

  disconnect(): void {
    this.socket$?.complete();
    this.socket$ = undefined;
    this.connectionSubject.next(false);
  }
}
