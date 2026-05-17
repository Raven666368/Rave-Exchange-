import { loadPrompt } from "./loadPrompt.js";

export async function buildRepairPrompt(
  originalPrompt: string,
  badOutput: string,
  validationErrors: string,
): Promise<string> {
  const system = await loadPrompt("system_prompt.txt");

  return [
    system,
    "",
    "REPAIR REQUEST",
    "Your previous response failed schema validation.",
    "Return ONLY valid JSON matching the schema.",
    "",
    "ORIGINAL PROMPT:",
    originalPrompt,
    "",
    "INVALID MODEL OUTPUT:",
    badOutput,
    "",
    "VALIDATION ERRORS:",
    validationErrors,
    "",
    "INSTRUCTIONS:",
    "- Fix all schema violations.",
    "- Do not add extra keys.",
    "- Do not add prose.",
    "- Return only JSON.",
  ].join("\n");
}
