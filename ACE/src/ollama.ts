/**
 * Ollama Client — kapselt den HTTP-Aufruf zum lokalen Modell.
 */

import { config } from "./config.js";
import type { BuiltPrompt } from "./prompt.js";

export interface LlmResult {
  rawResponse: string;
  model: string;
  durationMs: number;
  promptTokens: number;
  outputTokens: number;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaTagsResponse {
  models: Array<{ name: string }>;
}

const REQUEST_TIMEOUT_MS = 10 * 60 * 1_000;

export async function callOllama(builtPrompt: BuiltPrompt): Promise<LlmResult> {
  const endpoint = `${config.ollamaUrl}/api/generate`;
  const startMs = Date.now();

  const requestBody = {
    model: config.ollamaModel,
    prompt: builtPrompt.userPrompt,
    system: builtPrompt.systemPrompt,
    stream: false,
    options: {
      temperature: 0.1,
      num_predict: 8_192,
    },
  };

  console.log(`[ollama] Sende Prompt an ${config.ollamaModel} …`);

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    },
    REQUEST_TIMEOUT_MS
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "(kein Body)");
    throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}\nBody: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as OllamaGenerateResponse;

  if (!data.response || !data.done) {
    throw new Error(`Unerwartete Ollama-Antwort: done=${String(data.done)}, response=${data.response?.slice(0, 80)}`);
  }

  const durationMs = Date.now() - startMs;
  const outputTokens = data.eval_count ?? 0;
  const promptTokens = data.prompt_eval_count ?? 0;

  console.log(
    `[ollama] Fertig in ${(durationMs / 1000).toFixed(1)}s — ${promptTokens} Prompt-Tokens, ${outputTokens} Output-Tokens`
  );

  return {
    rawResponse: data.response,
    model: data.model,
    durationMs,
    promptTokens,
    outputTokens,
  };
}

export async function testConnection(): Promise<void> {
  const tagsUrl = `${config.ollamaUrl}/api/tags`;
  console.log(`[ollama] Verbindungstest: ${tagsUrl}`);
  const response = await fetchWithTimeout(tagsUrl, { method: "GET" }, 10_000);
  if (!response.ok) {
    throw new Error(`Ollama /api/tags: HTTP ${response.status}`);
  }
  const data = (await response.json()) as OllamaTagsResponse;
  const availableModels = data.models.map((m) => m.name);
  if (!availableModels.some((name) => name === config.ollamaModel || name.startsWith(config.ollamaModel.split(":")[0]))) {
    throw new Error(
      `Modell "${config.ollamaModel}" nicht gefunden.\n` +
        `Lade es mit: ollama pull ${config.ollamaModel}\nVerfügbar: ${availableModels.join(", ")}`
    );
  }
  console.log(`[ollama] ✓ Modell "${config.ollamaModel}" ist bereit.`);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Ollama-Anfrage abgebrochen nach ${timeoutMs / 1000}s Timeout. Läuft "${config.ollamaModel}" bereits? ` +
          `Prüfe mit: ollama list`
      );
    }
    throw new Error(`Ollama nicht erreichbar unter ${url}. Starte Ollama mit: ollama serve\n${String(err)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

if (require.main === module) {
  testConnection()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[ollama] Fehler:", err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
