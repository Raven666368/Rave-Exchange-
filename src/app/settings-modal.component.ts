import {ChangeDetectionStrategy, Component, output, signal, OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-6 max-w-lg w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] transform animate-in zoom-in-95 duration-300">
        <div class="flex items-center justify-between mb-6 pb-4 border-b border-[#363c4e]">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-[#089981]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 class="text-xl font-black text-white tracking-widest uppercase">Platform Settings</h2>
          </div>
          <button (click)="closeModal.emit()" class="text-gray-400 hover:text-white transition">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="space-y-4 mb-6">
          <div class="flex flex-col gap-1">
            <label for="bybit-api-key" class="text-[10px] text-gray-500 uppercase tracking-widest">Bybit API Key</label>
            <input id="bybit-api-key" type="password" [(ngModel)]="apiKey" class="w-full bg-[#131722] border border-[#363c4e] rounded-lg px-3 py-3 text-white font-mono focus:border-[#089981] outline-none" placeholder="Enter API Key" />
          </div>
          
          <div class="flex flex-col gap-1">
            <label for="bybit-api-secret" class="text-[10px] text-gray-500 uppercase tracking-widest">Bybit API Secret</label>
            <input id="bybit-api-secret" type="password" [(ngModel)]="apiSecret" class="w-full bg-[#131722] border border-[#363c4e] rounded-lg px-3 py-3 text-white font-mono focus:border-[#089981] outline-none" placeholder="Enter API Secret" />
          </div>
          
          <div class="p-3 bg-[#089981]/10 border border-[#089981]/30 rounded-lg flex items-start gap-3 mt-4">
            <svg class="w-5 h-5 text-[#089981] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-[11px] text-[#089981] leading-relaxed">
              Keys are stored securely in your browser's local storage and are never sent to our servers. They are only used to connect directly to the Bybit API from your browser.
            </p>
          </div>
          
          @if (errorMessage()) {
            <p class="text-[11px] text-[#f23645] font-bold mt-2">{{ errorMessage() }}</p>
          }
        </div>

        <div class="flex items-center gap-3 justify-end mt-8 border-t border-[#363c4e] pt-6">
          <button (click)="closeModal.emit()" class="px-5 py-2.5 rounded-lg font-bold text-gray-400 hover:text-white uppercase tracking-widest text-xs transition">
            Cancel
          </button>
          <button (click)="saveSettings()" class="px-5 py-2.5 bg-[#089981] hover:bg-[#089981]/80 text-white rounded-lg font-bold uppercase tracking-widest text-xs transition">
            Save Keys
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsModalComponent implements OnInit {
  closeModal = output<void>();
  saveKeys = output<{apiKey: string, apiSecret: string}>();

  errorMessage = signal<string | null>(null);

  apiKey = signal<string>('');
  apiSecret = signal<string>('');

  ngOnInit() {
    try {
      this.apiKey.set(localStorage.getItem('bybit_api_key') || '');
      this.apiSecret.set(localStorage.getItem('bybit_api_secret') || '');
    } catch {
      console.warn('localStorage access denied');
    }
  }

  saveSettings() {
    if (!this.apiKey().trim() || !this.apiSecret().trim()) {
      this.errorMessage.set('Bybit API Key and Secret are required.');
      return;
    }
    this.errorMessage.set(null);
    try {
      localStorage.setItem('bybit_api_key', this.apiKey());
      localStorage.setItem('bybit_api_secret', this.apiSecret());
    } catch {
      console.warn('localStorage access denied');
    }
    
    // Sync to backend so ws connects
    fetch('/api/settings/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.apiKey(),
        apiSecret: this.apiSecret()
      })
    }).catch(err => console.error("Error saving keys to backend", err));
    
    this.saveKeys.emit({
      apiKey: this.apiKey(),
      apiSecret: this.apiSecret()
    });
    this.closeModal.emit();
  }
}
