/**
 * Pipeline-Orchestrierung
 *
 * Verkettet alle Schritte der Barrierefreiheits-Analysepipeline:
 *   1. axe-core  → Collect → Normalize
 *   2. Playwright → Collect → Normalize
 *   3. Code       → Enrich (bestehende Findings) + Collect (Pattern-Findings) → Normalize
 *   4. Prompt Builder  → Token-Budget prüfen
 *   5. Ollama Client   → LLM-Aufruf
 *   6. Formatter       → Markdown + JSON speichern
 *
 * CLI-Flags:
 *   --url <url>         Ziel-URL (default: config.targetUrl)
 *   --src-dir <path>    Pfad zum src/-Verzeichnis der React-App (für Code-Anreicherung)
 *   --skip-llm          Prompt in results/ speichern, Ollama-Aufruf überspringen
 *   --axe-only          Nur axe-core ausführen (schneller Test)
 */

import { runAxeAnalysis } from "./modules/axe.js";
import { runPlaywrightChecks } from "./modules/playwright.js";
import { enrichWithCodeContext, runGrepPatterns } from "./modules/code.js";
import { buildPrompt } from "./prompt.js";
import { callOllama } from "./ollama.js";
import { formatAndSave } from "./output.js";
import { config } from "./config.js";
import type { UnifiedFinding, PipelineMetrics } from "./types.js";
import * as fs from "fs";
import * as path from "path";

// ── CLI-Argument-Parser ───────────────────────────────────────────────────

interface CliArgs {
  url: string;
  srcDir: string | null;
  skipLlm: boolean;
  axeOnly: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = {
    url: config.targetUrl,
    srcDir: null,
    skipLlm: false,
    axeOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--":
        continue;
      case "--url":
        args.url = argv[++i] ?? args.url;
        break;
      case "--src-dir":
        args.srcDir = argv[++i] ?? null;
        break;
      case "--skip-llm":
        args.skipLlm = true;
        break;
      case "--axe-only":
        args.axeOnly = true;
        break;
      default:
        if (argv[i]?.startsWith("--")) {
          console.warn(`[pipeline] Unbekanntes Flag: ${argv[i]}`);
        }
    }
  }

  return args;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────

function printBanner(url: string, flags: Omit<CliArgs, "url">): void {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   ACE-assistant — Barrierefreiheits-Analysepipeline  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Ziel:     ${url}`);
  console.log(`  Modell:   ${config.ollamaModel}`);
  if (flags.srcDir) console.log(`  src-dir:  ${flags.srcDir}`);
  if (flags.skipLlm) console.log(`  Modus:    --skip-llm (kein Ollama-Aufruf)`);
  if (flags.axeOnly) console.log(`  Modus:    --axe-only`);
  console.log();
}

function printSectionHeader(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 52 - title.length))}`);
}

function printSummary(
  findings: { axe: UnifiedFinding[]; playwright: UnifiedFinding[]; grep: UnifiedFinding[] },
  savedPaths: { markdownPath: string; jsonPath: string } | null,
  metrics: Partial<PipelineMetrics>
): void {
  const totalFindings = findings.axe.length + findings.playwright.length + findings.grep.length;
  const critical = [...findings.axe, ...findings.playwright, ...findings.grep].filter(
    (f) => f.severity === "critical"
  ).length;
  const serious = [...findings.axe, ...findings.playwright, ...findings.grep].filter(
    (f) => f.severity === "serious"
  ).length;

  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                  Analyse abgeschlossen               ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Findings gesamt:  ${totalFindings}`);
  console.log(`    axe-core:       ${findings.axe.length}`);
  console.log(`    Playwright:     ${findings.playwright.length}`);
  console.log(`    grep-Pattern:   ${findings.grep.length}`);
  console.log(`  Kritisch:         ${critical} critical, ${serious} serious`);

  if (metrics.phaseTimings) {
    const t = metrics.phaseTimings;
    console.log(`\n  ⏱ Laufzeit pro Phase:`);
    console.log(`    axe-core:       ${(t.axeMs / 1000).toFixed(1)}s`);
    console.log(`    Playwright:     ${(t.playwrightMs / 1000).toFixed(1)}s`);
    if (t.codeEnrichMs > 0) console.log(`    Code-Enrich:    ${(t.codeEnrichMs / 1000).toFixed(1)}s`);
    if (t.codePatternMs > 0) console.log(`    Code-Pattern:   ${(t.codePatternMs / 1000).toFixed(1)}s`);
    console.log(`    Prompt-Build:   ${(t.promptBuildMs / 1000).toFixed(1)}s`);
    if (t.llmMs > 0) console.log(`    LLM:            ${(t.llmMs / 1000).toFixed(1)}s`);
    if (t.outputMs > 0) console.log(`    Output:         ${(t.outputMs / 1000).toFixed(1)}s`);
    console.log(`    Gesamt:         ${(t.totalMs / 1000).toFixed(1)}s`);
  }

  if (metrics.enrichment && metrics.enrichment.totalEnrichable > 0) {
    const e = metrics.enrichment;
    console.log(`\n  Code-Anreicherung: ${e.enrichedCount}/${e.totalEnrichable} (${(e.quote * 100).toFixed(0)}%)`);
  }

  if (metrics.deduplication && metrics.deduplication.removed > 0) {
    const d = metrics.deduplication;
    console.log(`  Deduplizierung:    ${d.beforeDedup} → ${d.afterDedup} (${d.removed} entfernt)`);
  }

  if (metrics.tokens && metrics.tokens.actualPrompt > 0) {
    const tok = metrics.tokens;
    console.log(`\n  Token-Vergleich:`);
    console.log(`    Geschätzt:      ~${tok.estimated}`);
    console.log(`    Tatsächlich:    ${tok.actualPrompt} (Prompt) + ${tok.actualOutput} (Output)`);
  }

  if (savedPaths) {
    console.log(`\n  Markdown:  ${savedPaths.markdownPath}`);
    console.log(`  JSON:      ${savedPaths.jsonPath}`);
  }
  console.log();
}

// ── Prompt-Datei speichern (--skip-llm) ──────────────────────────────────

function savePromptToDisk(systemPrompt: string, userPrompt: string): void {
  const resultsDir = path.resolve(config.resultsDir);
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const promptPath = path.join(resultsDir, `prompt-${ts}.txt`);
  const content = `=== SYSTEM PROMPT ===\n\n${systemPrompt}\n\n=== USER PROMPT ===\n\n${userPrompt}`;
  fs.writeFileSync(promptPath, content, "utf-8");
  console.log(`[pipeline] Prompt gespeichert: ${promptPath}`);
}

// ── Zeitmessung ──────────────────────────────────────────────────────────

function timeMs(): number {
  return Date.now();
}

/** Misst die Dauer eines async Schritts und speichert sie in timings[key]. */
async function timed<T>(
  timings: Record<string, number>,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const t0 = timeMs();
  const result = await fn();
  timings[key] = timeMs() - t0;
  return result;
}

/** Baut PipelineMetrics aus den gesammelten Einzeldaten zusammen. */
function buildMetrics(
  timings: PipelineMetrics["phaseTimings"],
  enrichmentStats: { enrichedCount: number; totalEnrichable: number },
  dedupStats: { beforeDedup: number; afterDedup: number },
  tokens?: { estimated: number; actualPrompt: number; actualOutput: number }
): PipelineMetrics {
  return {
    phaseTimings: timings,
    tokens: tokens ?? { estimated: 0, actualPrompt: 0, actualOutput: 0 },
    enrichment: {
      ...enrichmentStats,
      quote: enrichmentStats.totalEnrichable > 0
        ? enrichmentStats.enrichedCount / enrichmentStats.totalEnrichable
        : 0,
    },
    deduplication: {
      ...dedupStats,
      removed: dedupStats.beforeDedup - dedupStats.afterDedup,
    },
  };
}

// ── Pipeline ──────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const pipelineStart = timeMs();
  const args = parseArgs();
  printBanner(args.url, { srcDir: args.srcDir, skipLlm: args.skipLlm, axeOnly: args.axeOnly });

  const timings: PipelineMetrics["phaseTimings"] = {
    axeMs: 0, playwrightMs: 0, codeEnrichMs: 0, codePatternMs: 0,
    promptBuildMs: 0, llmMs: 0, outputMs: 0, totalMs: 0,
  };

  let enrichmentStats = { enrichedCount: 0, totalEnrichable: 0 };
  let dedupStats = { beforeDedup: 0, afterDedup: 0 };

  // ── Schritt 1: axe-core ────────────────────────────────────────────────
  printSectionHeader("axe-core");
  const axeFindings = await timed(timings, "axeMs", () => runAxeAnalysis(args.url));

  if (args.axeOnly) {
    timings.totalMs = timeMs() - pipelineStart;
    console.log("\n[pipeline] --axe-only: Pipeline nach axe-core beendet.");
    printSummary({ axe: axeFindings, playwright: [], grep: [] }, null, { phaseTimings: timings });
    return;
  }

  // ── Schritt 2: Playwright ──────────────────────────────────────────────
  printSectionHeader("Playwright Checks");
  const pwFindings = await timed(timings, "playwrightMs", () => runPlaywrightChecks(args.url));

  // ── Schritt 3: Code — Anreicherung + Pattern-Findings ─────────────────
  let grepFindings: UnifiedFinding[] = [];

  if (args.srcDir) {
    const srcDir = args.srcDir;
    printSectionHeader("Code-Anreicherung");
    enrichmentStats = await timed(timings, "codeEnrichMs", () =>
      enrichWithCodeContext([...axeFindings, ...pwFindings], srcDir)
    );

    printSectionHeader("Code Pattern-Findings");
    const grepResult = await timed(timings, "codePatternMs", () => runGrepPatterns(srcDir));
    grepFindings = grepResult.findings;
    dedupStats = { beforeDedup: grepResult.beforeDedup, afterDedup: grepResult.afterDedup };
  } else {
    console.log("[pipeline] Kein --src-dir angegeben — Code-Phase übersprungen.");
  }

  // ── Schritt 4: Prompt Builder ────────────────────────────────────────
  printSectionHeader("Prompt Builder");
  const builtPrompt = await timed(timings, "promptBuildMs", async () =>
    buildPrompt({ axeFindings, playwrightFindings: pwFindings, grepFindings, targetUrl: args.url })
  );

  // ── Schritt 5: Ollama ────────────────────────────────────────────────
  if (args.skipLlm) {
    printSectionHeader("Prompt speichern (--skip-llm)");
    savePromptToDisk(builtPrompt.systemPrompt, builtPrompt.userPrompt);
    timings.totalMs = timeMs() - pipelineStart;
    printSummary(
      { axe: axeFindings, playwright: pwFindings, grep: grepFindings },
      null,
      buildMetrics(timings, enrichmentStats, dedupStats)
    );
    return;
  }

  printSectionHeader("Ollama LLM");
  const llmResult = await timed(timings, "llmMs", () => callOllama(builtPrompt));

  // ── Schritt 6: Formatter ──────────────────────────────────────────────
  printSectionHeader("Output Formatter");
  const t0 = timeMs();
  const metrics = buildMetrics(timings, enrichmentStats, dedupStats, {
    estimated: builtPrompt.estimatedTokens,
    actualPrompt: llmResult.promptTokens,
    actualOutput: llmResult.outputTokens,
  });

  const saved = formatAndSave({
    llmResult,
    builtPrompt,
    targetUrl: args.url,
    totalFindings: {
      axe: axeFindings.length,
      playwright: pwFindings.length,
      grep: grepFindings.length,
    },
    metrics,
  });
  timings.outputMs = timeMs() - t0;
  timings.totalMs = timeMs() - pipelineStart;

  printSummary(
    { axe: axeFindings, playwright: pwFindings, grep: grepFindings },
    saved,
    metrics
  );
}

// ── Einstiegspunkt ────────────────────────────────────────────────────────

run().catch((err) => {
  console.error("\n[pipeline] Fataler Fehler:", err instanceof Error ? err.message : String(err));
  if (err instanceof Error && err.stack) {
    console.error(err.stack.split("\n").slice(1, 4).join("\n"));
  }
  process.exit(1);
});
