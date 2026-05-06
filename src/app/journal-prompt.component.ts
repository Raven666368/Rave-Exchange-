import { Component } from '@angular/core';

@Component({
  selector: 'app-journal-prompt',
  standalone: true,
  template: `
    <div class="bg-[#1e222d] border border-[#363c4e] rounded-xl p-4 shadow-lg shrink-0 w-full overflow-hidden">
      <h3 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Journal Layer Configuration</h3>
      <div class="text-xs text-gray-300 font-mono space-y-2 custom-scrollbar">
        <p class="text-[#089981] mb-2">// System Prompt</p>
        <pre class="bg-black/50 p-3 rounded border border-[#363c4e] whitespace-pre-wrap">{{ promptText }}</pre>
        
        <p class="text-blue-400 mt-4 mb-2">// Input Parameters (Context)</p>
        <div class="bg-black/50 p-3 rounded border border-[#363c4e]">
          <ul class="list-disc pl-5 space-y-1">
            <li><strong>perception:</strong> Object containing macro/technical biases, selected action class, mode, and confidence score.</li>
            <li><strong>risk:</strong> Object containing risk score, max position size limit, forced mode, and veto reasoning.</li>
            <li><strong>execution:</strong> Object containing execution intent, target prices, and execution_allowed boolean.</li>
          </ul>
        </div>
      </div>
    </div>
  `
})
export class JournalPromptComponent {
  promptText = `You are the Journal Layer.

TASK
Write every signal, rejection, and trade outcome into a structured database record.

RECORD FIELDS
- timestamp
- symbol
- timeframe
- mode
- gate states
- macro bias
- technical bias
- liquidity state
- setup type
- entry
- stop
- targets
- quantity
- risk score
- execution result
- reason for rejection
- notes

RULES
- Journal every decision.
- Journal both trades and no-trades.
- Never block execution because of optional overlay metrics.
- Experimental overlays are research-only and never act as hard gates.`;
}
