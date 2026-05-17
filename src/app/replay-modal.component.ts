import { Component, signal, output } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-replay-modal",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto"
    >
      <div
        class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-8 max-w-2xl w-full shadow-[0_0_50px_rgba(0,0,0,0.5)] transform animate-in zoom-in-95 duration-300 flex flex-col"
      >
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-500"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="w-6 h-6"
              >
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </div>
            <div>
              <h2
                class="text-xl font-black text-white tracking-widest uppercase"
              >
                Replay Engine
              </h2>
              <p
                class="text-xs text-gray-400 font-mono uppercase tracking-widest"
              >
                Trade Timeline Simulation
              </p>
            </div>
          </div>
          <button
            (click)="close()"
            class="text-gray-400 hover:text-white transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="flex flex-col gap-6 font-mono">
          <!-- Controls -->
          <div class="flex flex-col gap-2">
            <label for="session-id-input" class="text-xs text-gray-500 uppercase tracking-widest">
              Session ID
            </label>
            <div class="flex gap-2">
               <input
                 id="session-id-input"
                 type="text"
                 class="flex-1 bg-[#2a2d36] border border-[#363c4e] text-white text-sm rounded outline-none p-2"
                 [value]="sessionId()"
                 (input)="onSessionInput($event)"
                 placeholder="e.g. sess-f8a4"
                 [disabled]="isPlaying()"
               />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label for="playback-speed-input" class="text-xs text-gray-500 uppercase tracking-widest">
              Playback Speed (ms per tick)
            </label>
            <div class="flex gap-2 items-center">
               <input id="playback-speed-input" class="w-full cursor-pointer accent-indigo-500" type="range" min="100" max="2000" step="100" [value]="speed()" (input)="onSpeedInput($event)" [disabled]="isPlaying()"/>
               <span class="text-white text-sm w-12 text-right">{{speed()}}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-4">
             @if (!isPlaying()) {
               <button
                 class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded transition"
                 (click)="startReplay()"
                 [disabled]="!sessionId()"
                 [class.opacity-50]="!sessionId()"
               >
                 START REPLAY
               </button>
             } @else {
               <button
                 class="flex-1 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 font-bold py-2 rounded transition"
                 (click)="stopReplay()"
               >
                 STOP REPLAY
               </button>
             }
          </div>

          <!-- Timeline Output -->
          <div class="bg-[#2a2d36] border border-[#363c4e] rounded p-4 flex flex-col gap-2 min-h-[200px] max-h-[300px] overflow-y-auto">
             @if (statusMsg()) {
               <div class="text-indigo-400 text-xs mb-2">{{ statusMsg() }}</div>
             }
             @for (trade of replayedTrades(); track trade.id) {
               <div class="text-xs flex items-center justify-between p-2 rounded bg-black/20 border border-white/5">
                 <div class="flex items-center gap-3">
                   <span [class]="trade.side === 'BUY' ? 'text-[#089981]' : 'text-[#f23645]'">{{trade.side}}</span>
                   <span class="text-white">{{trade.symbol}}</span>
                   <span class="text-gray-400">{{trade.qty}} &#64; {{trade.price}}</span>
                 </div>
                 <span class="text-gray-500">{{trade.timestamp | date:'HH:mm:ss.SSS'}}</span>
               </div>
             }
             @if (replayedTrades().length === 0 && !statusMsg()) {
               <div class="text-gray-500 text-xs text-center my-auto">Replayed trades will appear here...</div>
             }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .custom-scrollbar::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #363c4e;
        border-radius: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #4a5168;
      }
    `,
  ],
})
export class ReplayModalComponent {
  sessionId = signal<string>("");
  speed = signal<number>(500);
  isPlaying = signal<boolean>(false);
  statusMsg = signal<string>("");
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  replayedTrades = signal<any[]>([]);
  eventSource: EventSource | null = null;

  closeModal = output<void>();

  onSessionInput(e: Event) {
    this.sessionId.set((e.target as HTMLInputElement).value);
  }

  onSpeedInput(e: Event) {
    this.speed.set(parseInt((e.target as HTMLInputElement).value, 10));
  }

  startReplay() {
    this.stopReplay();
    this.replayedTrades.set([]);
    this.isPlaying.set(true);
    this.statusMsg.set("Connecting to stream...");

    const url = `/api/journal/replay?session_id=${encodeURIComponent(this.sessionId())}&speed=${this.speed()}`;
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener("start", (event: MessageEvent) => {
       const data = JSON.parse(event.data);
       this.statusMsg.set(`Replaying ${data.total} events for session: ${data.session_id}...`);
    });

    this.eventSource.addEventListener("end", () => {
       this.statusMsg.set("Replay finished.");
       this.isPlaying.set(false);
       this.eventSource?.close();
    });

    this.eventSource.addEventListener("error", () => {
       this.statusMsg.set("Disconnected or error.");
       this.isPlaying.set(false);
       this.eventSource?.close();
    });

    this.eventSource.onmessage = (event) => {
       if (event.data) {
          try {
             const trade = JSON.parse(event.data);
             this.replayedTrades.update(prev => [...prev, trade]);
             // Scroll to bottom logic could go here
          } catch {
            // Error parsing message
          }
       }
    };
  }

  stopReplay() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isPlaying.set(false);
  }

  close() {
    this.stopReplay();
    this.closeModal.emit();
  }
}
