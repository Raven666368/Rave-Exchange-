import { loadPrompt } from "./loadPrompt.js";
import { validateOrRepair } from "./validateOrRepair.js";
import type { CoordinatorResult } from "./types.js";

type ModelRunner = (prompt: string) => Promise<string>;

function ensureString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function ensureBoolean(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function buildModulePrompt(
  basePrompt: string,
  userInput: string,
  context?: unknown,
): string {
  const ctx = context ? `\n\nCONTEXT_JSON:\n${JSON.stringify(context)}` : "";
  return `${basePrompt}\n\nUSER_INPUT:\n${userInput}${ctx}`;
}

function summarizeFailure(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown coordinator failure";
}

export class AlchemyCoordinator {
  constructor(private readonly runModel: ModelRunner) {}

  async run(userInput: string): Promise<CoordinatorResult> {
    try {
      const perceptionBase = await loadPrompt("perception_prompt.txt");
      const perceptionPrompt = buildModulePrompt(perceptionBase, userInput);

      const perceptionResult = await validateOrRepair(
        perceptionPrompt,
        this.runModel,
      );
      if (!perceptionResult.ok) {
        return {
          ok: false,
          phase: "failed",
          mode: "SAFE_MODE",
          final_action: "rejected",
          failed_gate: "perception",
          execution_allowed: false,
          error: perceptionResult.error,
        };
      }

      const perception = perceptionResult.data;

      if (
        !perception ||
        !ensureString(perception.action_class) ||
        perception.action_class === "no_trade" ||
        perception.action_class === "reassess" ||
        perception.confidence <= 0 ||
        perception.data_quality <= 0
      ) {
        return {
          ok: true,
          phase: "done",
          mode: ensureString(perception.mode, "SAFE_MODE"),
          final_action: "no_trade",
          failed_gate:
            perception.action_class === "no_trade"
              ? "setup_filter"
              : "quality_filter",
          execution_allowed: false,
          perception,
        };
      }

      const riskBase = await loadPrompt("risk_prompt.txt").catch(() => "");
      if (!riskBase) {
        return {
          ok: true,
          phase: "done",
          mode: ensureString(perception.mode, "SAFE_MODE"),
          final_action: "trade_candidate",
          failed_gate: null,
          execution_allowed: true,
          perception,
        };
      }

      const riskPrompt = buildModulePrompt(riskBase, userInput, perception);

      const riskResult = await validateOrRepair(riskPrompt, this.runModel);
      if (!riskResult.ok) {
        return {
          ok: false,
          phase: "failed",
          mode: ensureString(perception.mode, "SAFE_MODE"),
          final_action: "rejected",
          failed_gate: "risk",
          execution_allowed: false,
          perception,
          error: riskResult.error,
        };
      }

      const riskRaw = riskResult.data as unknown;
      const risk = riskRaw as {
        risk_approved?: boolean;
        risk_score?: number;
        forced_mode?: string;
        veto_reason?: string;
        max_position_size?: string;
      };

      const riskApproved = ensureBoolean(risk.risk_approved, false);
      const forcedMode = ensureString(
        risk.forced_mode,
        ensureString(perception.mode, "SAFE_MODE"),
      );

      if (!riskApproved) {
        return {
          ok: true,
          phase: "done",
          mode: forcedMode,
          final_action: "no_trade",
          failed_gate:
            ensureString(risk.veto_reason, "risk_veto") || "risk_veto",
          execution_allowed: false,
          perception,
          risk,
        };
      }

      const executionBase = await loadPrompt("execution_prompt.txt").catch(
        () => "",
      );
      if (!executionBase) {
        return {
          ok: true,
          phase: "done",
          mode: forcedMode,
          final_action: "trade_candidate",
          failed_gate: null,
          execution_allowed: true,
          perception,
          risk,
        };
      }

      const executionPrompt = buildModulePrompt(executionBase, userInput, {
        perception,
        risk,
      });

      const executionResult = await validateOrRepair(
        executionPrompt,
        this.runModel,
      );
      if (!executionResult.ok) {
        return {
          ok: false,
          phase: "failed",
          mode: forcedMode,
          final_action: "rejected",
          failed_gate: "execution",
          execution_allowed: false,
          perception,
          risk,
          error: executionResult.error,
        };
      }

      const execution = executionResult.data as unknown;
      const executionAllowed =
        typeof (execution as { execution_allowed?: unknown })
          .execution_allowed === "boolean"
          ? (execution as { execution_allowed: boolean }).execution_allowed
          : false;

      if (!executionAllowed) {
        return {
          ok: true,
          phase: "done",
          mode: forcedMode,
          final_action: "no_trade",
          failed_gate: "execution_veto",
          execution_allowed: false,
          perception,
          risk,
          execution,
        };
      }

      const journalBase = await loadPrompt("journal_prompt.txt").catch(
        () => "",
      );
      if (!journalBase) {
        return {
          ok: true,
          phase: "done",
          mode: forcedMode,
          final_action: "trade_candidate",
          failed_gate: null,
          execution_allowed: true,
          perception,
          risk,
          execution,
        };
      }

      const journalPrompt = buildModulePrompt(journalBase, userInput, {
        perception,
        risk,
        execution,
      });

      const journalResult = await validateOrRepair(
        journalPrompt,
        this.runModel,
      );
      if (!journalResult.ok) {
        return {
          ok: false,
          phase: "failed",
          mode: forcedMode,
          final_action: "rejected",
          failed_gate: "journal",
          execution_allowed: false,
          perception,
          risk,
          execution,
          error: journalResult.error,
        };
      }

      const journal = journalResult.data as unknown;

      return {
        ok: true,
        phase: "done",
        mode: forcedMode,
        final_action: "trade_candidate",
        failed_gate: null,
        execution_allowed: true,
        perception,
        risk,
        execution,
        journal,
      };
    } catch (error: unknown) {
      return {
        ok: false,
        phase: "failed",
        mode: "SAFE_MODE",
        final_action: "rejected",
        failed_gate: "coordinator",
        execution_allowed: false,
        error: summarizeFailure(error),
      };
    }
  }
}
