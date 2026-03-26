# CLAUDE.md — Barrierefreiheits-Assistenzpipeline PoC

## Projektüberblick

Dies ist der Proof of Concept für eine Bachelorarbeit an der DHBW Stuttgart.

**Titel:** Kontextsensitive, lokale KI-Assistenz zur automatisierten Barrierefreiheitsanalyse von Rich-Client-Webanwendungen mittels Tool-Reports, Playwright-Interaktionen und Codeanalyse.

**Autor:** Joel Yerai Martinez Campo
**Betreuer:** Sascha Alexander Ströbel (DHBW), Ilko Homan (BITBW)
**Abgabe:** 11.05.2026

**Kernidee:** Drei unabhängige Datenquellen (axe-core, Playwright, grep) liefern Barrierefreiheits-Findings, die in ein einheitliches Schema normalisiert und per kombiniertem Prompt an ein lokales LLM übergeben werden. Das LLM erzeugt eine priorisierte, entwicklernahe To-Do-Liste (Must-have / Nice-to-have).

**Untersuchungsgegenstand:** BWEC Client — eine React/TypeScript Single-Page-Application der BITBW (IT Baden-Württemberg).

## Architektur

```
BWEC Client (React/TS)
        │
        ├──────────────┬──────────────┐
        ▼              ▼              ▼
   ┌─────────┐  ┌───────────┐  ┌──────────┐
   │ axe-core │  │ Playwright │  │   grep   │
   │ (DOM)    │  │ (E2E/ACE) │  │ (Code)   │
   └────┬─────┘  └─────┬──────┘  └────┬─────┘
        │              │              │
        ▼              ▼              ▼
   Normalizer     Normalizer     Normalizer
        │              │              │
        └──────────────┼──────────────┘
                       ▼
          ┌──────────────────────┐
          │ Unified Finding      │
          │ Schema (UFS)         │
          └──────────┬───────────┘
                     ▼
          ┌──────────────────────┐
          │ Kombinierter Prompt  │
          │ → Ollama (lokal)     │
          │ qwen2.5-coder:7b    │
          └──────────┬───────────┘
                     ▼
          ┌──────────────────────┐
          │ Priorisierte         │
          │ To-Do-Liste          │
          └──────────────────────┘
```

### Zentrale Designentscheidungen

1. **Single Combined Prompt statt Multi-Step-Kette:** Alle Findings werden in einem einzigen Prompt gebündelt. Gründe: Latenz lokaler Modelle, Auditierbarkeit (ein Prompt = eine nachvollziehbare Entscheidung), Einfachheit.
2. **Selektiver grep:** Nicht die ganze Codebasis scannen, sondern nur Dateien, die axe-core/Playwright als problematisch flaggen. Hält den Input im ~32k-Token-Fenster.
3. **Keine automatischen Code-Fixes:** Output ist eine Empfehlungsliste, kein Agent der Code ändert.
4. **100% lokal:** Ollama auf der lokalen Maschine, keine Cloud-API. Datenschutzanforderung der öffentlichen Verwaltung.
5. **axe einmalig, nicht pro Zustand:** axe-core wird einmal beim initialen DOM-Laden ausgeführt, nicht nach jeder Playwright-Interaktion. Begründung: NFA-02 verlangt Gesamtlaufzeit ≤ 10 min; jeder axe-Durchlauf dauert 3–8 s; 7 Checks × mehrere Zustände würden das Budget überschreiten. Die Entscheidung ist in Kapitel 7 (Evaluation) akademisch zu begründen.

## Tech Stack

- **Runtime:** Node.js + TypeScript (module: commonjs, target: ES2022)
- **Accessibility Testing:** axe-core (via @axe-core/playwright)
- **E2E/Interaktionstests:** Playwright
- **Code-Analyse:** grep (child_process, kein AST-Parsing)
- **LLM:** Ollama mit qwen2.5-coder:7b (läuft bereits auf der Test-VM)
- **Keine weiteren Frameworks** — bewusst minimal gehalten (PoC-Scope)

## Projektstruktur (aktuell)

```
ACE/
├── Claude.md                     # Diese Datei
├── package.json
├── tsconfig.json                 # module: commonjs, target: ES2022
├── src/
│   ├── index.ts                  # Haupteinstiegspunkt: orchestriert die Pipeline
│   ├── types.ts                  # UnifiedFinding, PipelineFindings, AceCheckDefinition
│   ├── config.ts                 # Zentrale Konfiguration, überschreibbar via Env-Vars
│   ├── prompt.ts                 # Prompt Builder + Token-Budget-Logik
│   ├── ollama.ts                 # HTTP-Client für Ollama + testConnection()
│   ├── output.ts                 # Formatter: Markdown + JSON Report in results/
│   └── modules/
│       ├── axe.ts                # Collector + Normalizer für axe-core
│       ├── playwright.ts         # Collector + Normalizer für Playwright-Checks
│       └── code.ts               # grep-Anreicherung + Pattern-Findings
└── results/                      # Generierte Reports (gitignored)
```

> **Hinweis zur Abweichung vom ursprünglichen Plan:** Die geplante Trennung in separate
> `collectors/` und `normalizers/`-Ordner sowie eine `config/`-Datei wurde zugunsten einer
> flacheren Struktur aufgegeben. Jedes Modul in `modules/` übernimmt Kollektion und
> Normalisierung in einer Datei. `tests/` wurde im PoC-Scope nicht umgesetzt.

## Unified Finding Schema

```typescript
// src/types.ts

export type FindingSource = "axe" | "playwright" | "grep";
export type Severity = "critical" | "serious" | "moderate" | "minor";
export type WcagLevel = "A" | "AA" | "AAA";
/** Taxonomie nach Fathallah et al. 2025 */
export type ViolationCategory = "syntaktisch" | "semantisch" | "layout";

export interface UnifiedFinding {
  id: string;               // z.B. "axe-001", "pw-003", "grep-012"
  source: FindingSource;
  ruleId: string;           // z.B. "color-contrast", "keyboard-trap"
  description: string;
  severity: Severity;
  wcagCriteria: string[];   // z.B. ["1.4.3", "2.1.1"]
  wcagLevel: WcagLevel;
  category: ViolationCategory; // syntaktisch | semantisch | layout (FA-05)
  selector: string | null;
  componentPath: string | null;
  codeSnippet: string | null;
  lineRange: [number, number] | null;
  rawData: Record<string, unknown>;
}
```

## Normalizer-Logik (Kurzfassung)

### axe-core → UnifiedFinding
- `violation.id` → `ruleId`
- `violation.impact` → `severity` (direkte Zuordnung: "critical"→"critical", etc.)
- `violation.tags` filtern nach `"wcag2a"`, `"wcag2aa"`, `"wcag21a"` etc. → `wcagLevel`
- `violation.tags` filtern nach Mustern wie `"wcag143"` → `wcagCriteria` = ["1.4.3"]
- `node.target` → `selector`
- `category`: heuristisch per ruleId: color-contrast → "layout", ARIA-Struktur-Regeln → "semantisch", Rest → "syntaktisch"
- `codeSnippet` und `componentPath` zunächst null (wird durch grep-Phase angereichert)

### Playwright → UnifiedFinding
- Playwright liefert keine "Findings" nativ — wir definieren 7 ACE-Checks als Funktionen
- Jeder Check hat ein Mapping zu WCAG-Kriterien (manuell definiert in CHECK_DEFINITIONS)
- Fehlgeschlagene Tests erzeugen Findings mit dem gemappten Severity/WCAG/category-Bezug
- `category`-Mapping: keyboard-trap/skip-link/focus-after-dialog → "semantisch"; focus-visible → "layout"; page-title/html-lang → "syntaktisch"
- Implementierte Checks: `keyboard-tab-reachable`, `keyboard-trap-free`, `focus-visible`, `skip-link-present`, `page-title-present`, `html-lang-present`, `focus-after-dialog`

### grep → UnifiedFinding (Anreicherung + eigenständige Findings)
- **Anreicherung:** Laufrichtung nach axe + Playwright; Selektoren aus Findings → grep im src/-Ordner → `componentPath`, `codeSnippet`, `lineRange` werden eingetragen
- **Eigenständige Pattern-Findings:**
  - `div-span-onclick` (semantisch) — onClick ohne Keyboard-Handler
  - `img-missing-alt` (syntaktisch) — `<img>` ohne alt
  - `label-missing-htmlfor` (syntaktisch) — `<label>` ohne htmlFor
  - `role-button-non-semantic` (semantisch) — role="button" auf Nicht-Button
  - `tabindex-removes-element` (semantisch) — tabIndex=-1
  - `autofocus-usage` (semantisch) — autoFocus

## Bekannte Abweichungen zwischen PoC und Thesis-Anforderungen

| Anforderung | Thesis-Text | PoC-Status | Bewertung |
|-------------|-------------|------------|-----------|
| FA-01 | axe-core DOM-Analyse | ✅ Implementiert | Vollständig |
| FA-02 | axe-core **pro Playwright-Zustand** | ⚠️ axe läuft einmalig, Playwright separat | Begründen in Kap. 7 (NFA-02) |
| FA-03 | grep-Anreicherung + Pattern-Findings | ✅ Implementiert | Vollständig |
| FA-04 | Kombinierter Prompt → Ollama | ✅ Implementiert | Vollständig |
| FA-05 | `category`-Feld im JSON-Output | ✅ Implementiert | Vollständig |
| NFA-01 | Lokale Ausführung, keine Cloud-API | ✅ Ollama | Vollständig |
| NFA-02 | Gesamtlaufzeit ≤ 10 min | ✅ Ca. 3–5 min erwartet | Messung ausstehend |
| NFA-03 | Output Markdown + JSON in results/ | ✅ Implementiert | Vollständig |
| NFA-04 | temperature = 0.1 | ✅ 0.1 in ollama.ts | Korrigiert |

### FA-02 Detailerklärung: axe pro Zustand

**Was die Thesis verspricht:** Nach jeder Playwright-Interaktion (Dialog öffnen, Tab-Navigation, etc.) wird axe-core erneut ausgeführt und analysiert den jeweils aktuellen DOM-Zustand. So werden z.B. Findings sichtbar, die erst nach dem Öffnen eines Modals entstehen (fehlende aria-describedby im Dialog-Container).

**Was der PoC liefert:** axe-core läuft einmal beim initialen DOM-Load. Die 7 Playwright-Checks laufen danach separat ohne axe-Aufruf.

**Akademische Begründung (für Kapitel 7):** NFA-02 fordert Gesamtlaufzeit ≤ 10 Minuten. Ein einzelner axe-Durchlauf dauert 3–8 Sekunden. Bei 7 Checks mit je 2–3 Zustandsänderungen = 14–21 zusätzliche Durchläufe = bis zu 168 Sekunden allein für axe. Auf einer lokalen Test-VM (kein Server) wäre das Budget mit LLM-Aufruf überschritten. Die Entscheidung ist somit durch NFA-02 erzwungen und stellt eine **bewusste Scope-Einschränkung** des PoC dar, nicht ein Fehler.

**Formulierungsvorschlag für Kap. 7:** *"FA-02 wurde im PoC dahingehend vereinfacht, dass axe-core einmalig beim initialen Seitenaufruf ausgeführt wird. Eine Analyse des DOM nach jeder Playwright-Interaktion wäre technisch realisierbar, würde jedoch NFA-02 (Gesamtlaufzeit ≤ 10 Minuten) verletzen, da jeder axe-Durchlauf 3–8 Sekunden benötigt. Diese Einschränkung ist in der Evaluation als Limitierung zu dokumentieren."*

## Prompt-Template

Der kombinierte Prompt folgt diesem Aufbau:

```
[System-Prompt]
Du bist ein erfahrener Barrierefreiheitsexperte für React/TypeScript-Webanwendungen.
Deine Aufgabe ist es, Findings aus drei unabhängigen Analysewerkzeugen zu einer
priorisierten, entwicklernahen To-Do-Liste zusammenzufassen.

Priorisierungsregeln:
- Must-have: WCAG 2.2 Level A + AA, Severity "critical" oder "serious"
- Nice-to-have: Severity "moderate"/"minor" oder Level AAA
- Wenn mehrere Findings dasselbe Element betreffen, fasse sie zusammen
- Gib für jeden Eintrag: WCAG-Kriterium, Dateipfad+Zeile, konkreten Fix-Vorschlag

[User-Prompt]
## Findings aus axe-core (DOM-Analyse):
{serializedAxeFindings}

## Findings aus Playwright (Interaktionstests):
{serializedPlaywrightFindings}

## Relevanter Codekontext:
{serializedCodeContext}

Erstelle jetzt die priorisierte To-Do-Liste.
```

### Token-Budget-Kalkulation
- qwen2.5-coder:7b Kontextfenster: ~32.768 Tokens
- System-Prompt: ~300 Tokens
- Typische axe-core-Findings (10-20 Violations): ~2.000-4.000 Tokens
- Typische Playwright-Findings (5-10 Checks): ~1.000-2.000 Tokens
- Selektiver Code-Kontext (10-15 Snippets à 20 Zeilen): ~3.000-5.000 Tokens
- **Gesamt Input: ~6.000-11.000 Tokens** → genug Platz für Output (~4.000-8.000 Tokens)

## Ollama-Integration

Ollama läuft auf `http://localhost:11434`. API-Aufruf:

```typescript
// POST http://localhost:11434/api/generate
{
  "model": "qwen2.5-coder:7b",
  "prompt": "<kombinierter prompt>",
  "system": "<system prompt>",
  "stream": false,
  "options": {
    "temperature": 0.1,      // Niedrig für konsistente, faktenbasierte Ausgabe (NFA-04)
    "num_predict": 8192       // Max Output-Tokens
  }
}
```

## Implementierungsstand

1. **Projektsetup:** `package.json`, `tsconfig.json`, Dependencies installiert ✓
2. **Types definieren:** `src/types.ts` (UnifiedFinding + category-Feld, PipelineFindings, AceCheckDefinition) ✓
3. **Konfiguration:** `src/config.ts` — Env-Vars für URL, Ollama-Endpoint, Modell ✓
4. **axe-core Modul:** `src/modules/axe.ts` — Collector + Normalizer + category-Mapping ✓
5. **Playwright Modul:** `src/modules/playwright.ts` — 7 ACE-Checks + WCAG-Mapping + category ✓
6. **Code-Modul:** `src/modules/code.ts` — grep-Anreicherung + 6 Pattern-Checks + category ✓
7. **Prompt Builder:** `src/prompt.ts` — Token-Budget, Severity-Sortierung, Serialisierung ✓
8. **Ollama Client:** `src/ollama.ts` — HTTP-Aufruf, Timeout, `testConnection()`, temperature=0.1 ✓
9. **Output Formatter:** `src/output.ts` — Markdown + JSON Report, Parsing der LLM-Antwort ✓
10. **Pipeline Orchestrierung:** `src/index.ts` — CLI-Flags, Ablaufsteuerung ✓
11. **Testen gegen BWEC Client:** Ausstehend

## Kontext: Wissenschaftlicher Hintergrund

Dieses PoC ist Teil einer Bachelorarbeit. Jede Designentscheidung muss akademisch begründbar sein:

- **Warum drei Quellen statt einer?** AccessGuru (Fathallah et al. 2025) nutzt nur Tool-Reports. Unser Ansatz ergänzt: Codekontext (grep) + Runtime-Verhalten (Playwright). Die These: die Kombination liefert höherwertige Empfehlungen.
- **Warum Single Prompt?** AccessGuru nutzt Multi-Step Re-Prompting. Wir argumentieren: lokale Modelle haben höhere Latenz pro Aufruf, ein einzelner Prompt ist auditierbar und reproduzierbar.
- **Warum grep statt AST?** Scope-Begrenzung. grep ist universell, braucht keinen Parser pro Sprache, und liefert für den PoC-Zweck ausreichend Kontext.
- **Warum Ollama/qwen2.5-coder:7b?** Datenschutzanforderung der öffentlichen Verwaltung (BITBW). Keine Daten dürfen an externe APIs gesendet werden.
- **Warum axe einmalig statt pro Zustand?** NFA-02 Laufzeitbudget — siehe FA-02-Abschnitt oben.

## Thesis-Kapitelstruktur (Schreibhinweise)

### Kapitel 1–5: Grundlagen (weitgehend fertig)
- Kap. 1: Einleitung, Problemstellung, Zielsetzung, Forschungsfragen
- Kap. 2: Grundlagen Barrierefreiheit (WCAG, BITV, ADA)
- Kap. 3: Verwandte Arbeiten (Fathallah et al. 2025 AccessGuru, andere Tools)
- Kap. 4: Anforderungsanalyse (FA-01..05, NFA-01..04)
- Kap. 5: Konzeption (Architektur, UFS, Prompt-Design)

### Kapitel 6: Implementierung (Stub → ausbauen)
Inhalt basierend auf diesem PoC:
- 6.1 Projektstruktur und Tech Stack (Node.js/TS, CommonJS, kein Framework)
- 6.2 Unified Finding Schema — Datenmodell, `category`-Feld (Taxonomie nach Fathallah)
- 6.3 axe-core Modul — Browser-Launch, AxeBuilder, Normalisierung, category-Heuristik
- 6.4 Playwright Modul — 7 Checks im Detail, WCAG-Mapping-Tabelle, category
- 6.5 Code-Modul — grep-Strategie, Muster-Katalog (6 Patterns), Anreicherungslogik
- 6.6 Prompt Builder — Token-Budget-Logik, Severity-Sortierung, Serialisierung
- 6.7 Ollama-Client — API-Aufruf, Timeout-Handling, testConnection()
- 6.8 Output Formatter — Markdown + JSON, Parsing der LLM-Antwort

### Kapitel 7: Evaluation (Stub → Kern der Arbeit)
- 7.1 Evaluationsstrategie (Design Science Research Artefakt-Evaluation)
- 7.2 Testumgebung (VM-Specs, BWEC-Client-Version, Ollama-Version)
- 7.3 Quantitative Ergebnisse
  - Anzahl Findings pro Quelle (axe / Playwright / grep)
  - Precision/Recall wenn möglich (manuelle Validierung eines Subsets)
  - Laufzeitmessung (axe, Playwright, grep, LLM, Gesamt) → NFA-02-Check
  - Token-Verbrauch (Prompt-Tokens, Output-Tokens)
- 7.4 Qualitative Ergebnisse
  - Beispiel-Output des LLM (muss-haben vs. nice-to-have)
  - Sind die Empfehlungen entwicklergerecht? (subjektive Bewertung + 1-2 Kollegen)
- 7.5 Limitierungen
  - FA-02: axe einmalig statt pro Zustand (Begründung NFA-02)
  - grep: keine semantische Analyse, False Positives bei dynamischem JSX
  - LLM: qwen2.5-coder:7b begrenzte Reasoning-Tiefe vs. GPT-4-Klasse
  - Nur eine SPA (BWEC Client) evaluiert → eingeschränkte Generalisierbarkeit

### Kapitel 8: Diskussion (Stub → ausbauen)
- 8.1 Beantwortung der Forschungsfragen
  - FF1: Kann ein lokales LLM Barrierefreiheits-Findings sinnvoll priorisieren?
  - FF2: Verbessert der Codekontext (grep) die Qualität der Empfehlungen?
  - FF3: Ist der Ansatz datenschutzkonform für die öffentliche Verwaltung?
- 8.2 Vergleich mit AccessGuru (Fathallah et al. 2025)
  - Gemeinsamkeiten: Tool-Report → LLM-Pipeline
  - Unterschiede: lokal vs. Cloud, Single Prompt vs. Multi-Step, grep-Kontext
- 8.3 Übertragbarkeit auf andere SPAs / Technologien

### Kapitel 9: Fazit und Ausblick (Stub → ausbauen)
- Zusammenfassung der Ergebnisse
- Ausblick: axe pro Zustand als nächste Iteration, AST statt grep, Fine-Tuning für DE-Sprache

### Sonstiges (vor Abgabe)
- **Sperrvermerk:** Bold-Text-Inline-Frage entfernen (ist noch drin im PDF)
- **Abstract:** Platzhalter durch echten Abstract ersetzen (nach Evaluation)
- **KI-Erklärungstabelle:** Ausfüllen (Liste der genutzten KI-Tools)
- **Literaturverzeichnis:** Fathallah et al. 2025 Vollreferenz prüfen

## Stilregeln für Code

- TypeScript strict mode
- Async/await statt Callbacks
- Klare Fehlerbehandlung (try/catch mit aussagekräftigen Fehlermeldungen)
- Jede Datei hat einen Headerkommentar mit Zweck
- Console.log nur für Pipeline-Fortschritt, nicht für Debug-Output
- Ergebnisse werden als JSON + Markdown in `results/` geschrieben

## Wichtige Befehle

```bash
# Projekt starten
npm install
npm run build

# Pipeline ausführen (gegen BWEC Client)
npm run analyze -- --url http://localhost:3000

# Nur axe-core testen
npm run test:axe -- --url http://localhost:3000

# Nur Playwright-Tests
npm run test:playwright

# Ollama-Verbindung prüfen
npm run test:ollama

# Vollständige Pipeline mit Output
npm run analyze:full

# Prompt speichern ohne LLM-Aufruf (zum Debuggen)
npm run analyze -- --url http://localhost:3000 --skip-llm

# Mit Codekontext (grep-Anreicherung)
npm run analyze -- --url http://localhost:3000 --src-dir /pfad/zum/bwec-client/src
```
