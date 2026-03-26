/**
 * Unified Finding Schema (UFS) — zentrales Datenmodell der Pipeline.
 *
 * Alle Quellen (axe-core, Playwright, grep) werden vor dem Prompt-Building
 * in dieses Format überführt. Felder, die eine Quelle nicht liefern kann,
 * bleiben null und können später durch Code-Anreicherung ergänzt werden.
 */

export type FindingSource = "axe" | "playwright" | "grep";

export type Severity = "critical" | "serious" | "moderate" | "minor";

export type WcagLevel = "A" | "AA" | "AAA";

/** Taxonomie nach Fathallah et al. 2025 */
export type ViolationCategory = "syntaktisch" | "semantisch" | "layout";

export interface UnifiedFinding {
  id: string;
  source: FindingSource;
  ruleId: string;
  description: string;
  severity: Severity;
  wcagCriteria: string[];
  wcagLevel: WcagLevel;
  /** Verletzungskategorie: syntaktisch = fehlende/falsche Attribute, semantisch = falsche Bedeutung/Struktur, layout = visuell */
  category: ViolationCategory;
  selector: string | null;
  componentPath: string | null;
  codeSnippet: string | null;
  lineRange: [number, number] | null;
  rawData: Record<string, unknown>;
}

export interface PipelineFindings {
  axe: UnifiedFinding[];
  playwright: UnifiedFinding[];
  grep: UnifiedFinding[];
  collectedAt: string;
  targetUrl: string;
}

export interface PipelineMetrics {
  /** Laufzeit pro Phase in Millisekunden */
  phaseTimings: {
    axeMs: number;
    playwrightMs: number;
    codeEnrichMs: number;
    codePatternMs: number;
    promptBuildMs: number;
    llmMs: number;
    outputMs: number;
    totalMs: number;
  };
  /** Token-Schätzung vs. tatsächliche Tokens aus Ollama */
  tokens: {
    estimated: number;
    actualPrompt: number;
    actualOutput: number;
  };
  /** Anreicherungsquote: wie viele Findings mit Code angereichert werden konnten */
  enrichment: {
    enrichedCount: number;
    totalEnrichable: number;
    quote: number; // 0–1
  };
  /** Findings vor und nach Deduplizierung */
  deduplication: {
    beforeDedup: number;
    afterDedup: number;
    removed: number;
  };
}

export interface AceCheckDefinition {
  ruleId: string;
  description: string;
  severity: Severity;
  wcagCriteria: string[];
  wcagLevel: WcagLevel;
  category: ViolationCategory;
}
