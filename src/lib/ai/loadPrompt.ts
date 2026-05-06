import { readFile } from "fs/promises";
import path from "path";

export async function loadPrompt(filename: string): Promise<string> {
  const safeFilename = path.basename(filename);
  const filePath = path.join(process.cwd(), "prompts", safeFilename);
  return await readFile(filePath, "utf8");
}
