import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BotConfigDto,
  BotKillSwitchDto,
  BotStatusDto,
  BotJournalEntryDto
} from './bot.models';

@Injectable({ providedIn: 'root' })
export class BotApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/bot';

  getStatus(): Observable<BotStatusDto> {
    return this.http.get<BotStatusDto>(`${this.baseUrl}/status`);
  }

  getKillSwitch(): Observable<BotKillSwitchDto> {
    return this.http.get<BotKillSwitchDto>(`${this.baseUrl}/killswitch`);
  }

  setKillSwitch(armed: boolean): Observable<BotKillSwitchDto> {
    return this.http.post<BotKillSwitchDto>(`${this.baseUrl}/killswitch`, { armed });
  }

  getConfig(): Observable<BotConfigDto> {
    return this.http.get<BotConfigDto>(`${this.baseUrl}/config`);
  }

  updateConfig(payload: Partial<BotConfigDto>): Observable<BotConfigDto> {
    return this.http.put<BotConfigDto>(`${this.baseUrl}/config`, payload);
  }

  getJournal(): Observable<BotJournalEntryDto[]> {
    return this.http.get<BotJournalEntryDto[]>(`${this.baseUrl}/journal`);
  }

  getTraces(): Observable<any[]> {
    return this.http.get<any[]>('/api/traces');
  }

  saveJournalEntry(entry: Partial<BotJournalEntryDto>): Observable<BotJournalEntryDto> {
    return this.http.post<BotJournalEntryDto>(`${this.baseUrl}/journal`, entry);
  }
}
