/**
 * Code-Modul — kümmert sich um Pattern-Findings und
 * die Anreicherung vorhandener Findings mit Quellcode.
 *
 * Nutzt Node.js-natives File-Reading + RegExp statt grep,
 * damit die Pipeline plattformunabhängig läuft (Windows/macOS/Linux).
 */

import * as fs from "fs";
import * as path from "path";
import type { UnifiedFinding, ViolationCategory } from "../types.js";

const CONTEXT_LINES = 5;
const INCLUDE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const MAX_MATCHES_PER_PATTERN = 8;
const MAX_MATCHES_PER_TERM = 1;

const PATTERNS: Record<
  string,
  {
    description: string;
    severity: UnifiedFinding["severity"];
    wcag: string[];
    level: UnifiedFinding["wcagLevel"];
    category: ViolationCategory;
    pattern: RegExp;
  }
> = {
  "div-span-onclick": {
    description:
      "<div> oder <span> besitzen onClick, aber keinen Keyboard-Handler. Verwende <button> oder ergänze onKeyDown + role.",
    severity: "serious",
    wcag: ["2.1.1"],
    level: "A",
    category: "semantisch",
    pattern: /<(div|span)[^>]*onClick=/,
  },
  "img-missing-alt": {
    description: "<img> ohne alt-Attribut. Screenreader können das Bild nicht beschreiben.",
    severity: "critical",
    wcag: ["1.1.1"],
    level: "A",
    category: "syntaktisch",
    pattern: /<img\s(?![^>]*\balt=)[^>]*(\/?>)/,
  },
  "label-missing-htmlfor": {
    description: "<label> ohne htmlFor. Inputs bleiben unbeschriftet.",
    severity: "serious",
    wcag: ["1.3.1", "4.1.2"],
    level: "A",
    category: "syntaktisch",
    pattern: /<label(?![^>]*htmlFor)[^>]*>/,
  },
  "role-button-non-semantic": {
    description: 'role="button" auf Nicht-Button-Elementen. Prüfe Keyboard-Support.',
    severity: "moderate",
    wcag: ["2.1.1", "4.1.2"],
    level: "A",
    category: "semantisch",
    pattern: /role="button"/,
  },
  "tabindex-removes-element": {
    description: "tabIndex=-1 entfernt Elemente aus der Tab-Reihenfolge.",
    severity: "moderate",
    wcag: ["2.1.1"],
    level: "A",
    category: "semantisch",
    pattern: /tabIndex=\{-1\}|tabIndex="-1"/,
  },
  "autofocus-usage": {
    description: "autoFocus kann den Fokusfluss stören.",
    severity: "minor",
    wcag: ["2.4.3"],
    level: "A",
    category: "semantisch",
    pattern: /autoFocus/,
  },
};

interface FileMatch {
  patternId: string;
  filePath: string;
  relativeFilePath: string;
  lineNumber: number;
  lineContent: string;
  codeSnippet: string;
  lineRange: [number, number];
}

// ── Öffentliche API ──────────────────────────────────────────────────────

export interface CodeModuleStats {
  enrichedCount: number;
  totalEnrichable: number;
  findingsBeforeDedup: number;
  findingsAfterDedup: number;
}

export async function enrichWithCodeContext(
  findings: UnifiedFinding[],
  srcDir: string
): Promise<{ enrichedCount: number; totalEnrichable: number }> {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[code] srcDir nicht gefunden: ${srcDir}`);
    return { enrichedCount: 0, totalEnrichable: 0 };
  }

  const sourceFiles = collectSourceFiles(srcDir);
  const enrichable = findings.filter((f) => f.selector && !f.componentPath);
  let enriched = 0;

  for (const finding of enrichable) {
    const terms = extractSearchTerms(finding.selector!);
    if (terms.length === 0) continue;

    for (const term of terms) {
      const hits = searchInFiles(sourceFiles, term, srcDir, MAX_MATCHES_PER_TERM, true);
      if (hits.length === 0) continue;
      const hit = hits[0];
      const snippet = readSnippet(hit.filePath, hit.lineNumber);
      if (!snippet) continue;
      finding.componentPath = hit.relativeFilePath;
      finding.codeSnippet = snippet.snippet;
      finding.lineRange = snippet.lineRange;
      enriched += 1;
      break;
    }
  }

  console.log(`[code] ${enriched}/${enrichable.length} Findings mit Quellcode angereichert`);
  return { enrichedCount: enriched, totalEnrichable: enrichable.length };
}

export async function runGrepPatterns(
  srcDir: string
): Promise<{ findings: UnifiedFinding[]; beforeDedup: number; afterDedup: number }> {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[code] srcDir nicht gefunden: ${srcDir}`);
    return { findings: [], beforeDedup: 0, afterDedup: 0 };
  }

  const sourceFiles = collectSourceFiles(srcDir);
  const matches: FileMatch[] = [];

  for (const [patternId, definition] of Object.entries(PATTERNS)) {
    const hits = searchInFiles(sourceFiles, definition.pattern, srcDir, MAX_MATCHES_PER_PATTERN, false);
    for (const hit of hits) {
      const snippet = readSnippet(hit.filePath, hit.lineNumber);
      if (!snippet) continue;
      matches.push({
        patternId,
        filePath: hit.filePath,
        relativeFilePath: hit.relativeFilePath,
        lineNumber: hit.lineNumber,
        lineContent: hit.lineContent,
        codeSnippet: snippet.snippet,
        lineRange: snippet.lineRange,
      });
    }
    if (hits.length > 0) {
      console.log(`[code] ${patternId}: ${hits.length} Treffer`);
    }
  }

  const { findings, beforeDedup, afterDedup } = normalizeAndDedup(matches);
  return { findings, beforeDedup, afterDedup };
}

// ── Dateisuche (plattformunabhängig) ────────────────────────────────────

interface SourceFile {
  absolutePath: string;
  relativePath: string;
  lines: string[];
}

function collectSourceFiles(srcDir: string): SourceFile[] {
  const files: SourceFile[] = [];
  walkDir(srcDir, (filePath) => {
    const ext = path.extname(filePath);
    if (!INCLUDE_EXTENSIONS.has(ext)) return;
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      files.push({
        absolutePath: filePath,
        relativePath: path.relative(srcDir, filePath),
        lines: content.split("\n"),
      });
    } catch {
      // Datei nicht lesbar — überspringen
    }
  });
  return files;
}

function walkDir(dir: string, callback: (filePath: string) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walkDir(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

interface SearchHit {
  filePath: string;
  relativeFilePath: string;
  lineNumber: number;
  lineContent: string;
}

function searchInFiles(
  files: SourceFile[],
  patternOrLiteral: RegExp | string,
  _srcDir: string,
  maxMatches: number,
  literalMode: boolean
): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const file of files) {
    if (hits.length >= maxMatches) break;

    for (let i = 0; i < file.lines.length; i++) {
      if (hits.length >= maxMatches) break;
      const line = file.lines[i];
      const match = literalMode
        ? line.includes(patternOrLiteral as string)
        : (patternOrLiteral as RegExp).test(line);

      if (match) {
        hits.push({
          filePath: file.absolutePath,
          relativeFilePath: file.relativePath,
          lineNumber: i + 1,
          lineContent: line,
        });
      }
    }
  }

  return hits;
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────────

function extractSearchTerms(selector: string): string[] {
  const terms = new Set<string>();
  const idMatch = /^#([\w-]+)$|#([\w-]+)/.exec(selector);
  if (idMatch) {
    const id = idMatch[1] ?? idMatch[2];
    terms.add(`id="${id}"`);
    terms.add(`id='${id}'`);
    terms.add(`id={\`${id}\`}`);
  }
  const ariaMatch = /\[aria-label="([^"]+)"\]/.exec(selector);
  if (ariaMatch) {
    terms.add(`aria-label="${ariaMatch[1]}"`);
  }
  const classMatches = [...selector.matchAll(/\.([\w-]{4,})/g)];
  const GENERIC = new Set(["active", "disabled", "selected", "open", "hidden", "show", "fade"]);
  for (const cls of classMatches) {
    if (!GENERIC.has(cls[1])) terms.add(cls[1]);
  }
  const attrMatch = /\[([\w-]+)="([^"]{3,})"\]/.exec(selector);
  if (attrMatch && attrMatch[1] !== "aria-label") {
    terms.add(attrMatch[2]);
  }
  return [...terms];
}

function readSnippet(
  filePath: string,
  lineNumber: number
): { snippet: string; lineRange: [number, number] } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const startLine = Math.max(1, lineNumber - CONTEXT_LINES);
    const endLine = Math.min(lines.length, lineNumber + CONTEXT_LINES);
    const snippet = lines
      .slice(startLine - 1, endLine)
      .map((line: string, idx: number) => `${startLine + idx}: ${line}`)
      .join("\n");
    return { snippet, lineRange: [startLine, endLine] };
  } catch {
    return null;
  }
}

function normalizeAndDedup(matches: FileMatch[]): {
  findings: UnifiedFinding[];
  beforeDedup: number;
  afterDedup: number;
} {
  const findings: UnifiedFinding[] = [];
  let counter = 0;

  for (const match of matches) {
    const definition = PATTERNS[match.patternId];
    if (!definition) continue;
    findings.push({
      id: `grep-${String(++counter).padStart(3, "0")}`,
      source: "grep",
      ruleId: match.patternId,
      description: definition.description,
      severity: definition.severity,
      wcagCriteria: definition.wcag,
      wcagLevel: definition.level,
      category: definition.category,
      selector: null,
      componentPath: match.relativeFilePath,
      codeSnippet: match.codeSnippet,
      lineRange: match.lineRange,
      rawData: {
        patternId: match.patternId,
        lineNumber: match.lineNumber,
        lineContent: match.lineContent,
        filePath: match.filePath,
      },
    });
  }

  const beforeDedup = findings.length;
  const deduped: UnifiedFinding[] = [];
  const seen = new Set<string>();
  for (const finding of findings) {
    const key = `${finding.ruleId}|${finding.componentPath}|${finding.lineRange?.[0] ?? 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(finding);
  }

  console.log(`[code] ${deduped.length} Pattern-Findings nach Deduplizierung (${beforeDedup} vor Dedup)`);
  return { findings: deduped, beforeDedup, afterDedup: deduped.length };
}
