import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TradingOpsFacade, TradingOpsTab } from './trading-ops.facade';

@Component({
  selector: 'app-trading-ops-center',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  template: `
    <div class="bg-[#1e222d] rounded-xl border border-[#363c4e] shadow-lg flex flex-col h-full text-xs font-mono text-gray-300">
      
      <!-- Header / Tabs -->
      <div class="flex items-center border-b border-[#363c4e] sticky top-0 bg-[#1e222d] z-10 shrink-0">
        <button [class.text-[#089981]]="vm().activeTab === 'sessions'" [class.border-b-2]="vm().activeTab === 'sessions'" [class.border-[#089981]]="vm().activeTab === 'sessions'" class="px-4 py-3 hover:bg-white/5 transition flex items-center gap-2" (click)="setTab('sessions')">
          <mat-icon class="text-[16px] w-4 h-4">fact_check</mat-icon> Session
        </button>
        <button [class.text-[#089981]]="vm().activeTab === 'validation'" [class.border-b-2]="vm().activeTab === 'validation'" [class.border-[#089981]]="vm().activeTab === 'validation'" class="px-4 py-3 hover:bg-white/5 transition flex items-center gap-2" (click)="setTab('validation')">
          <mat-icon class="text-[16px] w-4 h-4">verified</mat-icon> Validation
        </button>
        <button [class.text-[#089981]]="vm().activeTab === 'execution'" [class.border-b-2]="vm().activeTab === 'execution'" [class.border-[#089981]]="vm().activeTab === 'execution'" class="px-4 py-3 hover:bg-white/5 transition flex items-center gap-2" (click)="setTab('execution')">
          <mat-icon class="text-[16px] w-4 h-4">terminal</mat-icon> Execution
        </button>
        <button [class.text-[#089981]]="vm().activeTab === 'journal'" [class.border-b-2]="vm().activeTab === 'journal'" [class.border-[#089981]]="vm().activeTab === 'journal'" class="px-4 py-3 hover:bg-white/5 transition flex items-center gap-2" (click)="setTab('journal')">
          <mat-icon class="text-[16px] w-4 h-4">menu_book</mat-icon> Journal
        </button>
        <button [class.text-[#089981]]="vm().activeTab === 'alerts'" [class.border-b-2]="vm().activeTab === 'alerts'" [class.border-[#089981]]="vm().activeTab === 'alerts'" class="px-4 py-3 hover:bg-white/5 transition flex items-center gap-2" (click)="setTab('alerts')">
          <mat-icon class="text-[16px] w-4 h-4">notifications</mat-icon> Alerts
        </button>
      </div>

      <!-- Tab Content Area -->
      <div class="p-4 flex-1 overflow-y-auto custom-scrollbar">
        @if (vm().error) {
          <div class="bg-red-500/10 border border-red-500/50 text-red-500 px-3 py-2 rounded mb-4">
            {{ vm().error }}
          </div>
        }
        @if (vm().result) {
          <div class="bg-[#089981]/10 border border-[#089981]/50 text-[#089981] px-3 py-2 rounded mb-4">
            {{ vm().result?.message }}
          </div>
        }

        <!-- Sessions Form -->
        @if (vm().activeTab === 'sessions') {
          <form [formGroup]="sessionForm" (ngSubmit)="submit()" class="space-y-4">
            <div>
              <label class="block text-gray-400 mb-1" for="session">Target Session</label>
            <select id="session" formControlName="session" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
              <option value="ASIAN">Asian Range</option>
              <option value="LONDON">London Open</option>
              <option value="NEW_YORK">New York Kill Zone</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" formControlName="cmeGapChecked" id="cmeGap" class="accent-[#089981] w-4 h-4">
            <label for="cmeGap">CME Gaps Checked</label>
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" formControlName="fundingChecked" id="funding" class="accent-[#089981] w-4 h-4">
            <label for="funding">Funding Rates & Bias Checked</label>
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" formControlName="rolloverChecked" id="rollover" class="accent-[#089981] w-4 h-4">
            <label for="rollover">Rollover Timings Validated</label>
          </div>
        </form>
        } @else if (vm().activeTab === 'validation') {
        <!-- Validation Form -->
        <form [formGroup]="validationForm" (ngSubmit)="submit()" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
             <div>
               <label class="block text-gray-400 mb-1" for="valSymbol">Symbol</label>
               <input id="valSymbol" formControlName="symbol" type="text" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none uppercase" placeholder="BTCUSDT">
             </div>
             <div>
               <label class="block text-gray-400 mb-1" for="confScore">Confluence Score (0-9)</label>
               <input id="confScore" formControlName="confluenceScore" type="number" min="0" max="9" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
             </div>
          </div>
          <div class="flex items-center gap-3 mt-4">
            <input type="checkbox" formControlName="liquiditySweep" id="liq" class="accent-[#089981] w-4 h-4">
            <label for="liq">Liquidity Sweep Confirmed</label>
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" formControlName="mssConfirmed" id="mss" class="accent-[#089981] w-4 h-4">
            <label for="mss">Market Structure Shift (MSS) Confirmed</label>
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" formControlName="riskAccepted" id="risk" class="accent-[#089981] w-4 h-4">
            <label for="risk">Max 1% Risk / Asymmetric RR Accepted</label>
          </div>
        </form>
        } @else if (vm().activeTab === 'execution') {
        <!-- Execution Form -->
        <form [formGroup]="executionForm" (ngSubmit)="submit()" class="space-y-4">
           <div class="grid grid-cols-2 gap-4">
             <div>
               <label class="block text-gray-400 mb-1" for="execSymbol">Symbol</label>
               <input id="execSymbol" formControlName="symbol" type="text" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none uppercase">
             </div>
             <div>
               <label class="block text-gray-400 mb-1" for="execSide">Side</label>
               <select id="execSide" formControlName="side" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
                 <option value="BUY">LONG (Buy)</option>
                 <option value="SELL">SHORT (Sell)</option>
               </select>
             </div>
             <div>
               <label class="block text-gray-400 mb-1" for="execQty">Quantity</label>
               <input id="execQty" formControlName="qty" type="number" step="0.001" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
             </div>
             <div>
               <label class="block text-gray-400 mb-1" for="execType">Type</label>
               <select id="execType" formControlName="orderType" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
                 <option value="MARKET">Market</option>
                 <option value="LIMIT">Limit</option>
                 <option value="STOP">Stop</option>
               </select>
             </div>
           </div>
           
           <div class="flex gap-4 mt-2">
            <div class="flex items-center gap-2">
              <input type="checkbox" formControlName="reduceOnly" id="reduce" class="accent-[#089981] w-4 h-4">
              <label for="reduce">Reduce Only</label>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" formControlName="dryRun" id="dry" class="accent-yellow-500 w-4 h-4">
              <label for="dry" class="text-yellow-500">Testnet / Dry Run</label>
            </div>
           </div>
        </form>
        } @else if (vm().activeTab === 'journal') {
        <!-- Journal Form -->
        <form [formGroup]="journalForm" (ngSubmit)="submit()" class="space-y-4">
           <div>
               <label class="block text-gray-400 mb-1" for="journSymbol">Symbol</label>
               <input id="journSymbol" formControlName="symbol" type="text" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none uppercase" placeholder="BTCUSDT">
           </div>
           <div>
               <label class="block text-gray-400 mb-1" for="journThesis">Thesis / Narrative</label>
               <textarea id="journThesis" formControlName="thesis" rows="3" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none"></textarea>
           </div>
           <div>
               <label class="block text-gray-400 mb-1" for="journEntry">Entry Justification</label>
               <textarea id="journEntry" formControlName="entryReason" rows="2" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none"></textarea>
           </div>
           <div class="grid grid-cols-2 gap-4">
             <div>
                 <label class="block text-gray-400 mb-1" for="journExit">Exit Reason (Optional)</label>
                 <input id="journExit" formControlName="exitReason" type="text" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
             </div>
             <div>
                 <label class="block text-gray-400 mb-1" for="journOutcome">Outcome</label>
                 <select id="journOutcome" formControlName="outcome" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
                   <option value="">- Select -</option>
                   <option value="WIN">Win (+R)</option>
                   <option value="LOSS">Loss (-R)</option>
                   <option value="BE">Break Even</option>
                 </select>
             </div>
           </div>
        </form>
        } @else if (vm().activeTab === 'alerts') {
        <!-- Alerts Form -->
        <form [formGroup]="alertForm" (ngSubmit)="submit()" class="space-y-4">
           <div>
               <label class="block text-gray-400 mb-1" for="alertTitle">Alert Title</label>
               <input id="alertTitle" formControlName="title" type="text" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none" placeholder="e.g. London Open">
           </div>
           <div class="grid grid-cols-2 gap-4">
             <div>
                 <label class="block text-gray-400 mb-1" for="alertTime">Trigger At (UTC)</label>
                 <input id="alertTime" formControlName="triggerAt" type="time" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none style-color-scheme-dark">
             </div>
             <div>
                 <label class="block text-gray-400 mb-1" for="alertChan">Delivery Channel</label>
                 <select id="alertChan" formControlName="channel" class="w-full bg-[#131722] border border-[#363c4e] rounded px-3 py-2 focus:border-[#089981] outline-none">
                   <option value="IN_APP">In-App Alert</option>
                   <option value="TELEGRAM">Telegram Bot</option>
                 </select>
             </div>
           </div>
           <div class="flex items-center gap-3 mt-4">
              <input type="checkbox" formControlName="enabled" id="enabled" class="accent-[#089981] w-4 h-4">
              <label for="enabled">Active</label>
           </div>
        </form>
        }
      </div>

      <!-- Footer / Action Area -->
      <div class="p-4 border-t border-[#363c4e] mt-auto shrink-0 bg-[#1e222d]">
         <div class="flex justify-end gap-3">
           <button class="bg-[#131722] hover:bg-[#363c4e] text-white py-2 px-6 rounded transition border border-[#363c4e]" (click)="resetForm()">
             Reset
           </button>
           <button class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2 px-6 rounded transition flex items-center justify-center min-w-[120px]" 
                   (click)="submit()" 
                   [disabled]="vm().loading || currentForm.invalid">
             @if (vm().loading) {
               <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
             } @else {
               Submit Stage
             }
           </button>
         </div>
      </div>
    </div>
  `,
  styles: [`
    ::-webkit-calendar-picker-indicator {
      filter: invert(1);
    }
  `]
})
export class TradingOpsCenterComponent {
  private fb = inject(FormBuilder);
  private facade = inject(TradingOpsFacade);

  vm = this.facade.vm;

  sessionForm: FormGroup;
  validationForm: FormGroup;
  executionForm: FormGroup;
  journalForm: FormGroup;
  alertForm: FormGroup;

  constructor() {
    this.sessionForm = this.fb.group({
      session: ['LONDON', Validators.required],
      cmeGapChecked: [false, Validators.requiredTrue],
      fundingChecked: [false, Validators.requiredTrue],
      rolloverChecked: [false, Validators.requiredTrue]
    });

    this.validationForm = this.fb.group({
      symbol: ['BTCUSDT', Validators.required],
      confluenceScore: [0, [Validators.required, Validators.min(0), Validators.max(9)]],
      liquiditySweep: [false, Validators.requiredTrue],
      mssConfirmed: [false, Validators.requiredTrue],
      riskAccepted: [false, Validators.requiredTrue]
    });

    this.executionForm = this.fb.group({
      symbol: ['BTCUSDT', Validators.required],
      side: ['BUY', Validators.required],
      qty: [0, [Validators.required, Validators.min(0.000001)]],
      orderType: ['MARKET', Validators.required],
      reduceOnly: [false],
      dryRun: [true]
    });

    this.journalForm = this.fb.group({
      symbol: ['BTCUSDT', Validators.required],
      thesis: ['', Validators.required],
      entryReason: ['', Validators.required],
      exitReason: [''],
      outcome: ['']
    });

    this.alertForm = this.fb.group({
      title: ['', Validators.required],
      triggerAt: ['', Validators.required],
      channel: ['IN_APP', Validators.required],
      enabled: [true]
    });
  }

  get currentForm(): FormGroup {
    switch (this.vm().activeTab) {
      case 'validation': return this.validationForm;
      case 'execution': return this.executionForm;
      case 'journal': return this.journalForm;
      case 'alerts': return this.alertForm;
      default: return this.sessionForm;
    }
  }

  setTab(tab: TradingOpsTab) {
    this.facade.setActiveTab(tab);
  }

  resetForm() {
    this.currentForm.reset();
    this.facade.clear();
  }

  submit() {
    const form = this.currentForm;
    if (form.invalid) {
      form.markAllAsTouched();
      // Directly mutating the state error signal for simplicity of this implementation
      return;
    }
    
    this.facade.submitGate(this.vm().activeTab, form.value);
  }
}

