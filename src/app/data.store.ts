import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DataStore {
  currentVolume24h = signal<number | null>(null);
  spread = signal<number | null>(null);
}
