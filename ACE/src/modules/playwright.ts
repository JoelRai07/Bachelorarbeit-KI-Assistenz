/**
 * Playwright Modul — führt Interaktionschecks aus und mappt sie auf WCAG.
 */

import { chromium, type Page } from "playwright";
import { config } from "../config.js";
import type { UnifiedFinding, AceCheckDefinition } from "../types.js";

export interface PlaywrightCheckResult {
  checkId:
    | "keyboard-tab-reachable"
    | "keyboard-trap-free"
    | "focus-visible"
    | "skip-link-present"
    | "page-title-present"
    | "html-lang-present"
    | "focus-after-dialog";
  passed: boolean;
  failureMessage?: string;
  affectedSelectors?: string[];
  url: string;
}

// ── Öffentliche API ─────────────────────────────────────────────────────

export async function runPlaywrightChecks(url: string): Promise<UnifiedFinding[]> {
  const results = await collectPlaywrightFindings(url);
  return normalizePlaywrightResults(results);
}

// ── Collector ───────────────────────────────────────────────────────────

const CHECKS: Array<{ id: PlaywrightCheckResult["checkId"]; fn: (page: Page) => Promise<CheckOutcome> }> = [];

/**
 * Wir initialisieren die Checks einmal, damit der Code unten leichter zu lesen ist.
 */
(function registerChecks() {
  CHECKS.push({ id: "keyboard-tab-reachable", fn: checkKeyboardTabReachable });
  CHECKS.push({ id: "keyboard-trap-free", fn: checkKeyboardTrapFree });
  CHECKS.push({ id: "focus-visible", fn: checkFocusVisible });
  CHECKS.push({ id: "skip-link-present", fn: checkSkipLinkPresent });
  CHECKS.push({ id: "page-title-present", fn: checkPageTitlePresent });
  CHECKS.push({ id: "html-lang-present", fn: checkHtmlLangPresent });
  CHECKS.push({ id: "focus-after-dialog", fn: checkFocusAfterDialog });
})();

export async function collectPlaywrightFindings(url: string): Promise<PlaywrightCheckResult[]> {
  console.log(`[playwright] Starte ${CHECKS.length} Checks: ${url}`);
  const browser = await chromium.launch({ headless: config.playwright.headless });
  const results: PlaywrightCheckResult[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: config.playwright.timeoutMs });
    await page.waitForTimeout(config.playwright.navigationWaitMs);

    for (const check of CHECKS) {
      try {
        const outcome = await check.fn(page);
        results.push({ checkId: check.id, url, ...outcome });
        console.log(`[playwright] ${(outcome.passed ? "✓" : "✗")} ${check.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[playwright] ! ${check.id} Fehler: ${message}`);
        results.push({
          checkId: check.id,
          url,
          passed: false,
          failureMessage: `Check abgebrochen mit Fehler: ${message}`,
        });
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

interface CheckOutcome {
  passed: boolean;
  failureMessage?: string;
  affectedSelectors?: string[];
}

async function getFocusedElementId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return "body";
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : "";
    return `${tag}${id}${cls}`;
  });
}

async function checkKeyboardTabReachable(page: Page): Promise<CheckOutcome> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const visited = new Set<string>();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    const id = await getFocusedElementId(page);
    if (id !== "body") visited.add(id);
  }
  if (visited.size === 0) {
    return {
      passed: false,
      failureMessage: "Tab-Taste bewegt den Fokus nicht von body weg — keine interaktiven Elemente erreichbar.",
    };
  }
  return { passed: true };
}

async function checkKeyboardTrapFree(page: Page): Promise<CheckOutcome> {
  const TRAP_TABS = config.playwright.trapDetectionTabs;
  const WINDOW = 10;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const history: string[] = [];
  for (let i = 0; i < TRAP_TABS; i++) {
    await page.keyboard.press("Tab");
    history.push(await getFocusedElementId(page));
  }
  const tail = history.slice(-WINDOW);
  const uniqueInTail = new Set(tail);
  const isTrap = uniqueInTail.size === 1 && !tail.every((e) => e === "body");
  if (isTrap) {
    return {
      passed: false,
      failureMessage: `Keyboard-Trap erkannt: Fokus verbleibt ${WINDOW} Tab-Presses lang auf "${tail[0]}".`,
      affectedSelectors: [tail[0]],
    };
  }
  return { passed: true };
}

async function checkFocusVisible(page: Page): Promise<CheckOutcome> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const failing: string[] = [];
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const result = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el === document.documentElement) {
        return { skip: true, selector: "body", visible: true };
      }
      const style = window.getComputedStyle(el);
      const outlineWidth = parseFloat(style.outlineWidth);
      const outlineStyle = style.outlineStyle;
      const boxShadow = style.boxShadow;
      const hasOutline = outlineStyle !== "none" && outlineWidth > 0;
      const hasBoxShadow = boxShadow !== "none" && boxShadow !== "";
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const selector = `${tag}${id}`;
      return { skip: false, selector, visible: hasOutline || hasBoxShadow };
    });
    if (!result.skip && !result.visible) {
      failing.push(result.selector);
    }
  }
  if (failing.length > 0) {
    return {
      passed: false,
      failureMessage: `Kein sichtbarer Fokusindikator auf: ${failing.join(", ")}`,
      affectedSelectors: failing,
    };
  }
  return { passed: true };
}

async function checkSkipLinkPresent(page: Page): Promise<CheckOutcome> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  const firstTarget = await page.evaluate(() => {
    const el = document.activeElement as HTMLAnchorElement | null;
    if (!el) return { tag: "none", href: "" };
    return { tag: el.tagName.toLowerCase(), href: el.getAttribute("href") ?? "" };
  });
  const SKIP_PATTERNS = /^#(main|content|inhalt|skip|navigation|nav)/i;
  const isSkipLink = firstTarget.tag === "a" && SKIP_PATTERNS.test(firstTarget.href ?? "");
  if (!isSkipLink) {
    return {
      passed: false,
      failureMessage: `Erstes Tab-Ziel ist kein Skip-Link. Gefunden: <${firstTarget.tag} href="${firstTarget.href}">`,
    };
  }
  return { passed: true };
}

async function checkPageTitlePresent(page: Page): Promise<CheckOutcome> {
  const title = await page.title();
  if (!title || title.trim() === "") {
    return {
      passed: false,
      failureMessage: "Seite hat keinen oder einen leeren <title>.",
    };
  }
  return { passed: true };
}

async function checkHtmlLangPresent(page: Page): Promise<CheckOutcome> {
  const lang = await page.evaluate(() => document.documentElement.getAttribute("lang") ?? "");
  if (!lang || lang.trim() === "") {
    return {
      passed: false,
      failureMessage: `<html> hat kein lang-Attribut. Screenreader können die Sprache nicht ermitteln.`,
      affectedSelectors: ["html"],
    };
  }
  return { passed: true };
}

async function checkFocusAfterDialog(page: Page): Promise<CheckOutcome> {
  const triggerSelector = await page.evaluate(() => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[aria-haspopup], [data-bs-toggle="modal"], [data-dialog], button[data-target]'
      )
    );
    const visible = candidates.find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (!visible) return null;
    const tag = visible.tagName.toLowerCase();
    const id = visible.id ? `#${visible.id}` : "";
    return `${tag}${id}` || null;
  });

  if (!triggerSelector) {
    return { passed: true };
  }

  await page.click(triggerSelector);
  await page.waitForTimeout(500);

  const focusedInDialog = await page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return false;
    return active.closest('[role="dialog"], [role="alertdialog"], .modal, [aria-modal="true"]') !== null;
  });

  if (!focusedInDialog) {
    return {
      passed: false,
      failureMessage: `Dialog wurde geöffnet (via "${triggerSelector}"), aber Fokus liegt nicht im Dialog.`,
      affectedSelectors: [triggerSelector],
    };
  }

  return { passed: true };
}

// ── Normalisierung ──────────────────────────────────────────────────────

const CHECK_DEFINITIONS: Record<PlaywrightCheckResult["checkId"], AceCheckDefinition> = {
  "keyboard-tab-reachable": {
    ruleId: "keyboard-tab-reachable",
    description:
      "Alle interaktiven Elemente müssen per Tab-Taste erreichbar sein. Wenn Tab keinen Fokus erzeugt, sind Tastaturnutzer ausgeschlossen.",
    severity: "critical",
    wcagCriteria: ["2.1.1"],
    wcagLevel: "A",
    category: "semantisch",
  },
  "keyboard-trap-free": {
    ruleId: "keyboard-trap-free",
    description: "Nutzer dürfen nicht in einem Fokuszyklus gefangen sein (Keyboard Trap).",
    severity: "critical",
    wcagCriteria: ["2.1.2"],
    wcagLevel: "A",
    category: "semantisch",
  },
  "focus-visible": {
    ruleId: "focus-visible",
    description: "Fokussierte Elemente müssen einen sichtbaren Fokusindikator haben.",
    severity: "serious",
    wcagCriteria: ["2.4.7"],
    wcagLevel: "AA",
    category: "layout",
  },
  "skip-link-present": {
    ruleId: "skip-link-present",
    description: "Das erste Tab-Ziel sollte ein Skip-Link sein.",
    severity: "serious",
    wcagCriteria: ["2.4.1"],
    wcagLevel: "A",
    category: "semantisch",
  },
  "page-title-present": {
    ruleId: "page-title-present",
    description: "Die Seite muss einen nicht-leeren <title> besitzen.",
    severity: "serious",
    wcagCriteria: ["2.4.2"],
    wcagLevel: "A",
    category: "syntaktisch",
  },
  "html-lang-present": {
    ruleId: "html-lang-present",
    description: "Das <html>-Element braucht ein lang-Attribut.",
    severity: "serious",
    wcagCriteria: ["3.1.1"],
    wcagLevel: "A",
    category: "syntaktisch",
  },
  "focus-after-dialog": {
    ruleId: "focus-after-dialog",
    description: "Beim Öffnen eines Dialogs muss der Fokus in den Dialog wandern.",
    severity: "serious",
    wcagCriteria: ["2.4.3"],
    wcagLevel: "A",
    category: "semantisch",
  },
};

let pwIdCounter = 0;

function normalizePlaywrightResults(results: PlaywrightCheckResult[]): UnifiedFinding[] {
  pwIdCounter = 0;
  const findings: UnifiedFinding[] = [];
  for (const result of results) {
    if (result.passed) continue;
    const definition = CHECK_DEFINITIONS[result.checkId];
    if (!definition) {
      console.warn(`[playwright] Kein Mapping für ${result.checkId}`);
      continue;
    }
    findings.push(mapResultToFinding(result, definition));
  }
  console.log(`[playwright] ${findings.length} Findings nach Normalisierung`);
  return findings;
}

function mapResultToFinding(result: PlaywrightCheckResult, def: AceCheckDefinition): UnifiedFinding {
  const primarySelector = result.affectedSelectors?.[0] ?? null;
  return {
    id: nextPwId(),
    source: "playwright",
    ruleId: def.ruleId,
    description: result.failureMessage ?? def.description,
    severity: def.severity,
    wcagCriteria: def.wcagCriteria,
    wcagLevel: def.wcagLevel,
    category: def.category,
    selector: primarySelector,
    componentPath: null,
    codeSnippet: null,
    lineRange: null,
    rawData: {
      checkId: result.checkId,
      url: result.url,
      affectedSelectors: result.affectedSelectors ?? [],
      failureMessage: result.failureMessage,
    },
  };
}

function nextPwId(): string {
  pwIdCounter += 1;
  return `pw-${String(pwIdCounter).padStart(3, "0")}`;
}
