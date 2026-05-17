import type { AlchemyOutput } from "./types.js";
import { parseJsonSafe } from "./parseJson.js";
import { validateAlchemyOutput } from "./schema.js";
import { buildRepairPrompt } from "./repairPrompt.js";

type ModelRunner = (prompt: string) => Promise<string>;

function formatAjvErrors(errors: unknown): string {
  if (!Array.isArray(errors)) return "Unknown validation error";
  return errors
    .map((e: unknown) => {
      const err = e as { instancePath?: string; message?: string };
      return `${err.instancePath || "/"} ${err.message || "invalid"}`;
    })
    .join("; ");
}

export async function validateOrRepair(
  prompt: string,
  runModel: ModelRunner,
): Promise<{ ok: true; data: AlchemyOutput } | { ok: false; error: string }> {
  const firstRaw = await runModel(prompt);

  try {
    const firstParsed = parseJsonSafe<unknown>(firstRaw);

    if (validateAlchemyOutput(firstParsed)) {
      return { ok: true, data: firstParsed as AlchemyOutput };
    }

    const validationErrors = formatAjvErrors(validateAlchemyOutput.errors);
    const repairPrompt = await buildRepairPrompt(
      prompt,
      firstRaw,
      validationErrors,
    );
    const repairedRaw = await runModel(repairPrompt);

    const repairedParsed = parseJsonSafe<unknown>(repairedRaw);

    if (validateAlchemyOutput(repairedParsed)) {
      return { ok: true, data: repairedParsed as AlchemyOutput };
    }

    return {
      ok: false,
      error: `Repair failed: ${formatAjvErrors(validateAlchemyOutput.errors)}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Parse error";
    const repairPrompt = await buildRepairPrompt(prompt, firstRaw, errorMsg);
    const repairedRaw = await runModel(repairPrompt);

    try {
      const repairedParsed = parseJsonSafe<unknown>(repairedRaw);
      if (validateAlchemyOutput(repairedParsed)) {
        return { ok: true, data: repairedParsed as AlchemyOutput };
      }
      return {
        ok: false,
        error: `Repair failed: ${formatAjvErrors(validateAlchemyOutput.errors)}`,
      };
    } catch (repairErr: unknown) {
      const errorMsg =
        repairErr instanceof Error ? repairErr.message : "Repair parse failed";
      return { ok: false, error: errorMsg };
    }
  }
}
