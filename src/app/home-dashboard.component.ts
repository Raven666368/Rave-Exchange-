import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { App } from './app';

@Component({
  selector: 'app-home-dashboard',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="dashboard-grid">
      <!-- Welcome & Status Banner -->
      <div class="panel welcome-panel col-span-full md:col-span-8 lg:col-span-9">
        <div class="welcome-header">
          <div class="avatar">
            <mat-icon>person</mat-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold tracking-widest text-white uppercase">Welcome back, Commander</h2>
            <p class="text-xs text-gray-400 font-mono">Testnet Environment — 9-Gate Engine Online</p>
          </div>
        </div>
        <div class="stats-row">
          <div class="stat-box">
            <span class="stat-label">Total Balance (USDT)</span>
            <span class="stat-value text-[#089981]">\${{ (app.testnetBalance() || 0) | number:'1.2-2' }}</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Initial Balance</span>
            <span class="stat-value text-gray-300">$50,000.00</span>
          </div>
          <div class="stat-box">
            <span class="stat-label">Total PnL</span>
            <span class="stat-value font-bold" [class.text-[#089981]]="(app.testnetBalance() || 0) >= 50000" [class.text-[#f23645]]="(app.testnetBalance() || 0) < 50000">
              {{ ((app.testnetBalance() || 0) - 50000) > 0 ? '+' : '' }}\${{ ((app.testnetBalance() || 0) - 50000) | number:'1.2-2' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="panel actions-panel col-span-full md:col-span-4 lg:col-span-3">
        <h3 class="panel-title">Quick Actions</h3>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <button (click)="app.setAppTab('Trade')" class="action-btn border-[#089981] hover:bg-[#089981]/10">
            <mat-icon class="text-[#089981]">rocket_launch</mat-icon>
            <span class="text-[#089981]">Trade Now</span>
          </button>
          <button (click)="app.setAppTab('Ops')" class="action-btn border-blue-500 hover:bg-blue-500/10">
            <mat-icon class="text-blue-500">rule</mat-icon>
            <span class="text-blue-500">Ops Center</span>
          </button>
          <button (click)="app.showJournalModal.set(true)" class="action-btn border-purple-500 hover:bg-purple-500/10">
            <mat-icon class="text-purple-500">book</mat-icon>
            <span class="text-purple-500">Journal</span>
          </button>
          <button (click)="app.showSettingsModal.set(true)" class="action-btn border-gray-500 hover:bg-gray-500/10">
            <mat-icon class="text-gray-400">settings</mat-icon>
            <span class="text-gray-400">Settings</span>
          </button>
        </div>
      </div>

      <!-- Market Overview Mini -->
      <div class="panel col-span-full lg:col-span-6">
        <div class="flex justify-between items-center mb-4 pb-2 border-b border-[#363c4e]">
          <h3 class="panel-title">Market Highlights</h3>
          <button (click)="app.setAppTab('Markets')" class="text-xs text-[#089981] hover:underline font-mono uppercase">View All</button>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left font-mono text-[10px]">
            <thead class="text-gray-500 uppercase">
              <tr>
                <th class="py-2">Symbol</th>
                <th class="py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#363c4e]">
              @for (sym of ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'TAOUSDT']; track sym) {
              <tr class="hover:bg-white/5 cursor-pointer" (click)="app.updateSymbol(sym); app.setAppTab('Trade')">
                <td class="py-3 text-gray-300 font-bold uppercase">{{ sym }}</td>
                <td class="py-3 text-right">
                  @if (app.symbolPrices().get(sym); as p) {
                     \${{ p | number:'1.2-2' }}
                  } @else {
                     <span class="text-gray-600">---</span>
                  }
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Recent Trades -->
      <div class="panel col-span-full lg:col-span-6 flex flex-col h-full max-h-[350px]">
        <div class="flex justify-between items-center mb-4 pb-2 border-b border-[#363c4e] shrink-0">
          <h3 class="panel-title">Recent Execution History</h3>
          <button (click)="app.showFullHistoryModal.set(true)" class="text-xs text-[#089981] hover:underline font-mono uppercase">View All</button>
        </div>
        
        <div class="flex-1 overflow-y-auto custom-scrollbar">
          @if (app.orderHistory().length === 0) {
            <div class="flex flex-col items-center justify-center h-full text-gray-600 opacity-50 space-y-2 py-8">
              <mat-icon>history</mat-icon>
              <p class="text-[10px] uppercase tracking-widest">No recent trades</p>
            </div>
          } @else {
            <table class="w-full text-left font-mono text-[10px]">
              <thead class="text-gray-500 sticky top-0 bg-[#1e222d] uppercase">
                <tr>
                  <th class="py-2">Symbol</th>
                  <th class="py-2 text-center">Type</th>
                  <th class="py-2 text-right">Size</th>
                  <th class="py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#363c4e]">
                @for (entry of app.orderHistory().slice(0, 5); track entry.id) {
                  <tr class="hover:bg-white/5 transition-colors cursor-pointer" (click)="app.viewOrderDetails(entry)">
                    <td class="py-3 text-gray-300">{{ entry.symbol }}</td>
                    <td class="py-3 text-center">
                      <span [class]="entry.type === 'BUY' ? 'text-[#089981] font-bold' : 'text-[#f23645] font-bold'">
                        {{ entry.type }}
                      </span>
                    </td>
                    <td class="py-3 text-right text-gray-300">{{ entry.size }}</td>
                    <td class="py-3 text-right font-bold text-white">\${{ entry.price | number:'1.2-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 1.5rem;
      padding-bottom: 2rem;
    }
    .panel {
      background: #1e222d;
      border: 1px solid #363c4e;
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3);
    }
    .panel-title {
      font-size: 0.75rem;
      font-weight: 700;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin: 0;
    }
    .welcome-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.5rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(54,60,78,0.5);
    }
    .avatar {
      width: 3rem;
      height: 3rem;
      background: rgba(8,153,129,0.2);
      border: 1px solid rgba(8,153,129,0.5);
      border-radius: 9999px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #089981;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
    }
    .stat-box {
      background: #131722;
      border: 1px solid #363c4e;
      border-radius: 0.5rem;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .stat-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #6b7280;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      background: #131722;
      border: 1px solid;
      border-radius: 0.5rem;
      padding: 1rem 0;
      transition: all 0.2s ease;
    }
    .action-btn span {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 700;
    }
    
    @media (max-width: 768px) {
      .stats-row {
        grid-template-columns: 1fr;
      }
    }
    
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #363c4e;
      border-radius: 20px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeDashboardComponent {
  public app = inject(App);
}
