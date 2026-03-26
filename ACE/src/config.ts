/**
 * Zentraler Konfigurationsblock, überschreibbar via Umgebungsvariablen.
 * Lädt .env-Datei aus dem Projektroot (falls vorhanden).
 */

import * as dotenv from "dotenv";
dotenv.config();

export const config = {
  targetUrl: process.env.TARGET_URL ?? "http://localhost:3000",
  ollamaUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b",
  resultsDir: "./results",
  axe: {
    runOnly: {
      type: "tag" as const,
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
    },
    timeoutMs: 30_000,
  },
  playwright: {
    headless: true,
    navigationWaitMs: 2_000,
    trapDetectionTabs: 40,
    timeoutMs: 30_000,
  },
} as const;
