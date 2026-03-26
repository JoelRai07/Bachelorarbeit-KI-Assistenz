/**
 * Prompt Builder
 *
 * Bündelt alle Findings in einem einzigen Prompt für das LLM.
 */

import type { UnifiedFinding, Severity } from "./types.js";

export interface PromptInput {
  axeFindings: UnifiedFinding[];
  playwrightFindings: UnifiedFinding[];
  grepFindings: UnifiedFinding[];
  targetUrl: string;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  estimatedTokens: number;
  truncated: boolean;
  includedFindings: {
    axe: number;
    playwright: number;
    grep: number;
  };
}

const TOTAL_CONTEXT_WINDOW = 32_768;
const RESERVED_FOR_OUTPUT = 8_192;
const RESERVED_FOR_SYSTEM = 400;
const AVAILABLE_INPUT_TOKENS = TOTAL_CONTEXT_WINDOW - RESERVED_FOR_OUTPUT - RESERVED_FOR_SYSTEM;

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

const SYSTEM_PROMPT = `Du bist ein erfahrener Barrierefreiheitsexperte für React/TypeScript-Webanwendungen.
Deine Aufgabe ist es, Findings aus drei unabhängigen Analysewerkzeugen (axe-core, Playwright, grep) zu einer priorisierten, entwicklernahen To-Do-Liste zusammenzufassen.

AUSGABEFORMAT (strikt einhalten):

## Must-have
*WCAG 2.x Level A und AA, Severity "critical" oder "serious" — gesetzlich relevant*

### [ID] Kurztitel des Problems
- **WCAG:** X.X.X (Level X)
- **Schweregrad:** critical | serious
- **Element/Datei:** CSS-Selektor oder Dateipfad:Zeile
- **Problem:** Ein Satz — was ist konkret falsch?
- **Fix:** Konkreter Code-Vorschlag in JSX/TypeScript

## Nice-to-have
*Severity "moderate" oder "minor", Level AAA — empfohlen aber nicht gesetzespflichtig*

### [ID] Kurztitel des Problems
[gleiche Struktur]

PRIORISIERUNGSREGELN:
1. Must-have: Severity "critical" oder "serious" UND WCAG Level A oder AA
2. Nice-to-have: Severity "moderate" oder "minor" ODER Level AAA
3. Wenn mehrere Findings dasselbe Element betreffen, fasse sie zusammen
4. Nutze den Codekontext für konkrete React/TypeScript-Fixes
5. Antworte ausschließlich auf Deutsch
6. Erfinde keine Findings, die nicht in den Daten vorhanden sind

BEISPIEL (Few-Shot):

Eingabe-Finding:
[axe-007] CRITICAL | color-contrast | WCAG 1.4.3 (AA)
Beschreibung: Element hat unzureichenden Farbkontrast (2.8:1 statt 4.5:1)
Element: .sidebar > .nav-link
Datei: components/Sidebar.tsx:42-52
Code:
42: <a className="nav-link" href="/dashboard">
43:   Dashboard
44: </a>

Erwartete Ausgabe:

## Must-have

### [axe-007] Farbkontrast der Sidebar-Navigation unzureichend
- **WCAG:** 1.4.3 (Level AA)
- **Schweregrad:** critical
- **Element/Datei:** components/Sidebar.tsx:42
- **Problem:** Der Link ".nav-link" hat ein Kontrastverhältnis von 2.8:1, gefordert sind mindestens 4.5:1 (WCAG 1.4.3 AA).
- **Fix:**
\`\`\`tsx
// Sidebar.tsx — Farbe des Links anpassen
<a className="nav-link" style={{ color: "#1a1a2e" }} href="/dashboard">
  Dashboard
</a>
// Alternativ: CSS-Klasse mit ausreichendem Kontrast definieren
\`\`\`

---

Eingabe-Finding:
[grep-002] MODERATE | tabindex-removes-element | WCAG 2.1.1 (A)
Beschreibung: tabIndex=-1 entfernt Elemente aus der Tab-Reihenfolge.
Datei: components/Modal.tsx:18-28
Code:
18: <div className="modal-overlay" tabIndex={-1}>
19:   <div className="modal-content" role="dialog">
20:     <button className="close-btn">Schließen</button>

Erwartete Ausgabe:

## Nice-to-have

### [grep-002] tabIndex=-1 auf Modal-Overlay
- **WCAG:** 2.1.1 (Level A)
- **Schweregrad:** moderate
- **Element/Datei:** components/Modal.tsx:18
- **Problem:** Das Modal-Overlay hat tabIndex={-1}. Wenn das Overlay selbst fokussierbar sein soll (z.B. für Escape-Handling), ist das korrekt. Andernfalls entfernt es das Element unnötig aus der Tab-Reihenfolge.
- **Fix:**
\`\`\`tsx
// Falls Overlay nicht fokussierbar sein muss — tabIndex entfernen:
<div className="modal-overlay">
  <div className="modal-content" role="dialog" aria-modal="true">
    <button className="close-btn" autoFocus>Schließen</button>
\`\`\``.trim();

export function buildPrompt(input: PromptInput): BuiltPrompt {
  const { targetUrl } = input;
  const systemTokens = estimateTokens(SYSTEM_PROMPT);
  const availableForUser = AVAILABLE_INPUT_TOKENS - systemTokens;

  const { axe, playwright, grep, truncated } = applyTokenBudget(
    input.axeFindings,
    input.playwrightFindings,
    input.grepFindings,
    availableForUser
  );

  const userPrompt = buildUserPrompt(targetUrl, axe, playwright, grep, truncated, {
    totalAxe: input.axeFindings.length,
    totalPlaywright: input.playwrightFindings.length,
    totalGrep: input.grepFindings.length,
  });

  const totalTokens = systemTokens + estimateTokens(userPrompt);

  console.log(
    `[prompt] ~${totalTokens} Tokens geschätzt (Budget: ${TOTAL_CONTEXT_WINDOW}, Input: ${AVAILABLE_INPUT_TOKENS})`
  );

  if (truncated) {
    const skipped =
      input.axeFindings.length - axe.length +
      input.playwrightFindings.length - playwright.length +
      input.grepFindings.length - grep.length;
    console.warn(`[prompt] Token-Budget überschritten — ${skipped} Findings (moderate/minor) weggelassen`);
  }

  return {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    estimatedTokens: totalTokens,
    truncated,
    includedFindings: {
      axe: axe.length,
      playwright: playwright.length,
      grep: grep.length,
    },
  };
}

function buildUserPrompt(
  targetUrl: string,
  axeFindings: UnifiedFinding[],
  playwrightFindings: UnifiedFinding[],
  grepFindings: UnifiedFinding[],
  truncated: boolean,
  totals: { totalAxe: number; totalPlaywright: number; totalGrep: number }
): string {
  const truncationNote = truncated
    ? `\n Hinweis: Wegen Token-Budget wurden ${
        totals.totalAxe - axeFindings.length +
        totals.totalPlaywright - playwrightFindings.length +
        totals.totalGrep - grepFindings.length
      } Findings (moderate/minor) weggelassen. Alle critical/serious Findings sind enthalten.\n`
    : "";

  return `# Barrierefreiheits-Analyse: ${targetUrl}

Analysezeitpunkt: ${new Date().toISOString()}
Findings gesamt: axe-core=${totals.totalAxe}, Playwright=${totals.totalPlaywright}, grep=${totals.totalGrep}
${truncationNote}
---

## Findings aus axe-core (DOM-Analyse, ${axeFindings.length} von ${totals.totalAxe}):

${serializeFindingList(axeFindings)}

---

## Findings aus Playwright (Interaktionstests, ${playwrightFindings.length} von ${totals.totalPlaywright}):

${serializeFindingList(playwrightFindings)}

---

## Findings aus grep (Codeanalyse, ${grepFindings.length} von ${totals.totalGrep}):

${serializeFindingList(grepFindings)}

---

Erstelle jetzt die priorisierte To-Do-Liste gemäß dem vorgegebenen Ausgabeformat.`.trim();
}

function applyTokenBudget(
  axeFindings: UnifiedFinding[],
  playwrightFindings: UnifiedFinding[],
  grepFindings: UnifiedFinding[],
  budgetTokens: number
): {
  axe: UnifiedFinding[];
  playwright: UnifiedFinding[];
  grep: UnifiedFinding[];
  truncated: boolean;
} {
  const sortBySeverity = (a: UnifiedFinding, b: UnifiedFinding) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

  const sorted = {
    axe: [...axeFindings].sort(sortBySeverity),
    playwright: [...playwrightFindings].sort(sortBySeverity),
    grep: [...grepFindings].sort(sortBySeverity),
  };

  const result = { axe: [] as UnifiedFinding[], playwright: [] as UnifiedFinding[], grep: [] as UnifiedFinding[] };
  let usedTokens = 50; // Section-Overhead
  let truncated = false;

  const allSorted: Array<{ finding: UnifiedFinding; source: "axe" | "playwright" | "grep" }> = [
    ...sorted.axe.map((f) => ({ finding: f, source: "axe" as const })),
    ...sorted.playwright.map((f) => ({ finding: f, source: "playwright" as const })),
    ...sorted.grep.map((f) => ({ finding: f, source: "grep" as const })),
  ].sort((a, b) => SEVERITY_ORDER[a.finding.severity] - SEVERITY_ORDER[b.finding.severity]);

  for (const { finding, source } of allSorted) {
    const serialized = serializeFinding(finding);
    const tokens = estimateTokens(serialized) + 5;
    if (usedTokens + tokens > budgetTokens) {
      truncated = true;
      continue;
    }
    result[source].push(finding);
    usedTokens += tokens;
  }

  return { ...result, truncated };
}

function serializeFinding(finding: UnifiedFinding): string {
  const lines: string[] = [];
  lines.push(
    `[${finding.id}] ${finding.severity.toUpperCase()} | ${finding.ruleId} | WCAG ${finding.wcagCriteria.join(", ")} (${finding.wcagLevel})`
  );
  const desc = finding.description.length > 300 ? `${finding.description.slice(0, 297)}...` : finding.description;
  lines.push(`Beschreibung: ${desc}`);
  if (finding.selector) {
    lines.push(`Element: ${finding.selector}`);
  }
  if (finding.componentPath) {
    const lineInfo = finding.lineRange ? `:${finding.lineRange[0]}-${finding.lineRange[1]}` : "";
    lines.push(`Datei: ${finding.componentPath}${lineInfo}`);
  }
  if (finding.codeSnippet) {
    const snippetLines = finding.codeSnippet.split("\n");
    const truncated = snippetLines.length > 20 ? snippetLines.slice(0, 20) : snippetLines;
    lines.push(`Code:\n${truncated.join("\n")}`);
  }
  return lines.join("\n");
}

function serializeFindingList(findings: UnifiedFinding[]): string {
  if (findings.length === 0) return "(Keine Findings aus dieser Quelle)";
  return findings.map((f) => serializeFinding(f)).join("\n---\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
