import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemHealthState } from '../../core/state/event-schema';

@Component({
  selector: 'app-system-health',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] border border-[#1e222d] rounded-lg overflow-hidden font-mono text-[10px]">
      <div class="bg-[#1e222d] px-3 py-2 font-bold text-gray-400 uppercase tracking-widest border-b border-[#363c4e] flex justify-between items-center shrink-0">
        <span>System Health Matrix</span>
        <span class="text-green-500 animate-pulse">●</span>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-4">
        
        <!-- Redis Streams -->
        <div>
          <div class="text-blue-400 font-bold mb-1">[Redis Streams]</div>
          <div class="grid grid-cols-2 gap-1 pl-2 border-l border-[#363c4e]">
             <div class="text-gray-500">Lag: <span class="text-green-400">{{ (healthState()?.redisStreams?.lag !== undefined ? healthState()?.redisStreams?.lag : 0) }}ms</span></div>
             <div class="text-gray-500">Throughput: <span class="text-gray-300">{{ healthState()?.redisStreams?.throughput || 24 }} msgs/s</span></div>
             <div class="text-gray-500">Health: <span class="text-green-400">{{ healthState()?.redisStreams?.status || 'OK' }}</span></div>
          </div>
        </div>

        <!-- Workers -->
        <div>
          <div class="text-purple-400 font-bold mb-1">[Worker Fleet]</div>
          <div class="grid grid-cols-2 gap-1 pl-2 border-l border-[#363c4e]">
             <div class="text-gray-500">Status: <span class="text-green-400">{{ healthState()?.workers?.alive || 8 }}/{{ healthState()?.workers?.total || 8 }} ALIVE</span></div>
             <div class="text-gray-500">Processing: <span class="text-yellow-400">{{ healthState()?.workers?.avgLatency || 12 }}ms avg</span></div>
          </div>
        </div>

        <!-- Broker Protocol -->
        <div>
          <div class="text-cyan-400 font-bold mb-1">[Broker Protocol]</div>
          <div class="grid grid-cols-2 gap-1 pl-2 border-l border-[#363c4e]">
             <div class="text-gray-500">Latency: <span class="text-green-400">{{ healthState()?.broker?.latency || 45 }}ms</span></div>
             <div class="text-gray-500">Connection: <span class="text-green-400">{{ healthState()?.broker?.status || 'Stable' }}</span></div>
             <div class="text-gray-500 col-span-2">Rate Limit: <span class="text-gray-300">{{ healthState()?.broker?.capacityUtilization || 4 }}% capacity utilized</span></div>
          </div>
        </div>

        <!-- AI Cluster -->
        <div>
          <div class="text-red-400 font-bold mb-1">[AI Cluster]</div>
          <div class="pl-2 border-l border-[#363c4e] space-y-1">
             <div class="text-gray-500 w-full flex justify-between">
                <span>Active Strategies:</span> <span class="text-green-400">{{ healthState()?.aiCluster?.activeStrategies || 4 }}</span>
             </div>
             <div class="text-gray-500 w-full flex justify-between">
                <span>Suppressed:</span> <span class="text-red-400">{{ healthState()?.aiCluster?.suppressed || 2 }}</span>
             </div>
             <div class="text-gray-500 flex flex-col mt-1">
                <span>Confidence Spread:</span>
                <div class="flex h-1 mt-1 rounded overflow-hidden">
                  <div class="bg-red-500 w-1/3"></div>
                  <div class="bg-gray-500 w-1/4"></div>
                  <div class="bg-green-500 flex-1"></div>
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #363c4e; }
  `]
})
export class SystemHealthComponent {
  healthState = input<SystemHealthState | null>(null);
}
