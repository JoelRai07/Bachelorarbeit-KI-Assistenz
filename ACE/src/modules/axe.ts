/**
 * axe-core Modul — sammelt DOM-Findings und normalisiert sie direkt
 * in das Unified Finding Schema.
 */

import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import type { AxeResults, Result, NodeResult, ImpactValue } from "axe-core";
import { config } from "../config.js";
import type { UnifiedFinding, Severity, WcagLevel, ViolationCategory } from "../types.js";

export async function runAxeAnalysis(url: string): Promise<UnifiedFinding[]> {
  const results = await collectAxeFindings(url);
  return normalizeAxeResults(results);
}

async function collectAxeFindings(url: string): Promise<AxeResults> {
  console.log(`[axe] Starte Analyse: ${url}`);
  const browser = await chromium.launch({ headless: config.playwright.headless });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: config.playwright.timeoutMs });
    await page.waitForTimeout(config.playwright.navigationWaitMs);

    const results = await new AxeBuilder({ page })
      .withTags([...config.axe.runOnly.values])
      .analyze();

    console.log(
      `[axe] Fertig — ${results.violations.length} Violations, ` +
        `${results.passes.length} Passes, ${results.incomplete.length} Incomplete`
    );

    return results;
  } finally {
    await browser.close();
  }
}

// ── Normalisierung ──────────────────────────────────────────────────────

let axeIdCounter = 0;

function normalizeAxeResults(results: AxeResults): UnifiedFinding[] {
  axeIdCounter = 0;
  const findings: UnifiedFinding[] = [];

  for (const violation of results.violations) {
    const wcagLevel = extractWcagLevel(violation.tags);
    const wcagCriteria = extractWcagCriteria(violation.tags);

    for (const node of violation.nodes) {
      findings.push(mapNodeToFinding(violation, node, wcagLevel, wcagCriteria));
    }
  }

  console.log(`[axe] ${findings.length} Findings nach Normalisierung`);
  return findings;
}

/** Regeln, die primär visuell/layout-basiert sind */
const LAYOUT_RULES = new Set(["color-contrast", "color-contrast-enhanced"]);

/** Regeln, die semantische Bedeutung/Struktur betreffen */
const SEMANTIC_RULES = new Set([
  "heading-order", "landmark-one-main", "landmark-unique",
  "aria-required-children", "aria-required-parent", "aria-roles",
  "aria-allowed-attr", "aria-prohibited-attr", "aria-valid-attr",
  "aria-valid-attr-value", "aria-hidden-focus", "aria-hidden-body",
]);

function mapCategory(ruleId: string): ViolationCategory {
  if (LAYOUT_RULES.has(ruleId)) return "layout";
  if (SEMANTIC_RULES.has(ruleId)) return "semantisch";
  return "syntaktisch";
}

function mapNodeToFinding(
  violation: Result,
  node: NodeResult,
  wcagLevel: WcagLevel,
  wcagCriteria: string[]
): UnifiedFinding {
  const selectorEntry = node.target.length > 0 ? node.target.at(-1) : null;
  const selector = typeof selectorEntry === "string"
    ? selectorEntry
    : Array.isArray(selectorEntry)
    ? selectorEntry.join(" ")
    : null;

  return {
    id: nextAxeId(),
    source: "axe",
    ruleId: violation.id,
    description: violation.description,
    severity: mapSeverity(violation.impact ?? null),
    wcagCriteria,
    wcagLevel,
    category: mapCategory(violation.id),
    selector,
    componentPath: null,
    codeSnippet: null,
    lineRange: null,
    rawData: {
      help: violation.help,
      helpUrl: violation.helpUrl,
      tags: violation.tags,
      html: node.html,
      failureSummary: node.failureSummary,
    },
  };
}

function extractWcagLevel(tags: string[]): WcagLevel {
  if (tags.some((t) => /^wcag\d+aaa$/i.test(t))) return "AAA";
  if (tags.some((t) => /^wcag\d+aa$/i.test(t))) return "AA";
  return "A";
}

function extractWcagCriteria(tags: string[]): string[] {
  const criteria: string[] = [];
  for (const tag of tags) {
    const match = /^wcag(\d{3,})$/.exec(tag);
    if (!match) continue;
    const digits = match[1];
    const principle = digits[0];
    const guideline = digits[1];
    const criterion = digits.slice(2);
    criteria.push(`${principle}.${guideline}.${criterion}`);
  }
  return [...new Set(criteria)];
}

function mapSeverity(impact: ImpactValue): Severity {
  if (impact === "critical") return "critical";
  if (impact === "serious") return "serious";
  if (impact === "moderate") return "moderate";
  return "minor";
}

function nextAxeId(): string {
  axeIdCounter += 1;
  return `axe-${String(axeIdCounter).padStart(3, "0")}`;
}
