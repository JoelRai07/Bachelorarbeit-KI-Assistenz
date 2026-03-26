# ACE — Architektur und Pipelineablauf

> Dieses Dokument beschreibt die technische Architektur und den Ablauf der ACE-Pipeline (Accessibility Check Engine). Es dient als Grundlage für das Konzept- und Implementierungskapitel der Bachelorarbeit.

---

## 1. Systemübersicht

ACE ist eine lokal ausführbare Analysepipeline, die Barrierefreiheitsprobleme in React/TypeScript-Webanwendungen erkennt und priorisiert. Die Pipeline kombiniert drei unabhängige Datenquellen — statische DOM-Analyse (axe-core), Interaktionstests (Playwright) und Codeanalyse (Pattern-Matching) — und übergibt die normalisierten Ergebnisse an ein lokales LLM, das eine entwicklernahe To-Do-Liste erzeugt.

### Kernprinzipien

| Prinzip | Begründung |
|---------|------------|
| **100 % lokal** | Datenschutzanforderung der öffentlichen Verwaltung (BITBW). Keine Daten verlassen die Maschine. |
| **Single Combined Prompt** | Ein Prompt = eine nachvollziehbare Entscheidung. Lokale Modelle haben höhere Latenz pro Aufruf; Multi-Step würde NFA-02 (≤ 10 min) gefährden. |
| **Drei unabhängige Quellen** | Jede Quelle deckt einen anderen Aspekt ab: DOM-Struktur, Laufzeitverhalten, Quellcode-Patterns. Die Kombination liefert höherwertige Empfehlungen als eine einzelne Quelle. |
| **Minimaler Tech-Stack** | Node.js + TypeScript + Playwright + axe-core + Ollama. Jede Dependency hat einen konkreten Zweck, kein Framework-Overhead. |

---

## 2. Architekturdiagramm

```
                    ┌──────────────────────┐
                    │   Ziel-Webanwendung  │
                    │   (React/TS SPA)     │
                    └──────────┬───────────┘
                               │ HTTP
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   axe-core      │  │   Playwright    │  │   Code-Analyse  │
│   (DOM-Analyse) │  │   (E2E-Checks)  │  │   (Pattern-     │
│                 │  │                 │  │    Matching)     │
│ Chromium +      │  │ Chromium +      │  │ Node.js File-   │
│ AxeBuilder      │  │ 7 ACE-Checks    │  │ I/O + RegExp    │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Normalizer    │  │   Normalizer    │  │   Normalizer    │
│                 │  │                 │  │   + Dedup       │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                               ▼
                  ┌──────────────────────────┐
                  │  Unified Finding Schema  │
                  │  (gemeinsames Daten-     │
                  │   modell für alle        │
                  │   Findings)              │
                  └────────────┬─────────────┘
                               │
                  ┌────────────▼─────────────┐
                  │     Prompt Builder       │
                  │                          │
                  │ • Severity-Sortierung    │
                  │ • Token-Budget-Prüfung   │
                  │ • Serialisierung         │
                  └────────────┬─────────────┘
                               │
                  ┌────────────▼─────────────┐
                  │     Ollama (lokal)       │
                  │                          │
                  │  qwen2.5-coder:7b        │
                  │  temperature: 0.1        │
                  │  Single Combined Prompt  │
                  └────────────┬─────────────┘
                               │
                  ┌────────────▼─────────────┐
                  │    Output Formatter      │
                  │                          │
                  │ • Markdown-Report        │
                  │ • JSON-Report            │
                  │ • Pipeline-Metriken      │
                  └──────────────────────────┘
```

---

## 3. Datenmodell: Unified Finding Schema (UFS)

Das UFS ist das zentrale Datenmodell der Pipeline. Alle drei Quellen normalisieren ihre Ergebnisse in dieses Schema, bevor sie in den Prompt fließen.

```typescript
interface UnifiedFinding {
  id: string;                    // "axe-001", "pw-003", "grep-012"
  source: "axe" | "playwright" | "grep";
  ruleId: string;                // "color-contrast", "keyboard-trap-free"
  description: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  wcagCriteria: string[];        // ["1.4.3", "2.1.1"]
  wcagLevel: "A" | "AA" | "AAA";
  category: "syntaktisch" | "semantisch" | "layout";
  selector: string | null;       // CSS-Selektor des betroffenen Elements
  componentPath: string | null;  // Dateipfad (nach Code-Anreicherung)
  codeSnippet: string | null;    // Quellcode-Ausschnitt (nach Anreicherung)
  lineRange: [number, number] | null;
  rawData: Record<string, unknown>;
}
```

### Kategorisierung nach Fathallah et al. 2025

Das `category`-Feld klassifiziert Verletzungen in drei Typen:

| Kategorie | Beschreibung | Beispiele |
|-----------|-------------|-----------|
| **syntaktisch** | Fehlende oder falsche HTML-Attribute | `<img>` ohne `alt`, `<html>` ohne `lang`, `<label>` ohne `htmlFor` |
| **semantisch** | Falsche Bedeutung oder Struktur | `<div onClick>` statt `<button>`, falsche ARIA-Rollen, Keyboard-Traps |
| **layout** | Visuell wahrnehmbare Probleme | Farbkontrast, fehlender Fokusindikator |

---

## 4. Pipelineablauf im Detail

### Phase 1: axe-core (DOM-Analyse)

**Modul:** `src/modules/axe.ts`
**Input:** Ziel-URL
**Output:** `UnifiedFinding[]`

1. Playwright startet eine Chromium-Instanz im Headless-Modus
2. Navigation zur Ziel-URL, Warten auf `networkidle`
3. `AxeBuilder` führt axe-core im Browser-Kontext aus
4. Konfiguration: nur WCAG 2.x Level A und AA Tags (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`)
5. Jede Violation wird pro betroffenen DOM-Knoten in ein `UnifiedFinding` normalisiert

**Normalizer-Logik:**
- `violation.impact` → `severity` (direkte Zuordnung)
- `violation.tags` → WCAG-Level-Extraktion via Regex (`/^wcag\d+aa$/i` → AA)
- `violation.tags` → WCAG-Kriterien-Extraktion (`"wcag143"` → `"1.4.3"`)
- `violation.id` → `category` (Heuristik: `color-contrast` → layout, ARIA-Regeln → semantisch, Rest → syntaktisch)
- `componentPath`, `codeSnippet`, `lineRange` bleiben `null` — werden in Phase 3 ergänzt

### Phase 2: Playwright (Interaktionstests)

**Modul:** `src/modules/playwright.ts`
**Input:** Ziel-URL
**Output:** `UnifiedFinding[]`

Playwright führt 7 vordefinierte ACE-Checks aus, die über reine DOM-Analyse hinausgehen und Laufzeitverhalten prüfen:

| Check | WCAG | Severity | Kategorie | Was wird geprüft |
|-------|------|----------|-----------|-----------------|
| `keyboard-tab-reachable` | 2.1.1 (A) | critical | semantisch | Tab-Taste bewegt den Fokus von `<body>` weg |
| `keyboard-trap-free` | 2.1.2 (A) | critical | semantisch | Fokus bleibt nicht auf demselben Element nach 40 Tab-Presses hängen |
| `focus-visible` | 2.4.7 (AA) | serious | layout | Fokussierte Elemente haben sichtbaren Indikator (outline/box-shadow) |
| `skip-link-present` | 2.4.1 (A) | serious | semantisch | Erstes Tab-Ziel ist ein Link zu `#main`, `#content` o.ä. |
| `page-title-present` | 2.4.2 (A) | serious | syntaktisch | `<title>` ist nicht leer |
| `html-lang-present` | 3.1.1 (A) | serious | syntaktisch | `<html lang="...">` existiert |
| `focus-after-dialog` | 2.4.3 (A) | serious | semantisch | Beim Öffnen eines Dialogs wandert der Fokus in den Dialog |

**Ablauf:**
1. Zweite Chromium-Instanz wird gestartet
2. Navigation zur Ziel-URL
3. Checks werden sequenziell ausgeführt (keyboard-basierte Checks verändern den Fokuszustand)
4. Fehlgeschlagene Checks erzeugen Findings mit dem vordefinierten WCAG-Mapping
5. Fehler innerhalb eines Checks brechen nicht die gesamte Pipeline ab — der Check wird als fehlgeschlagen markiert

### Phase 3: Code-Analyse (Anreicherung + Pattern-Findings)

**Modul:** `src/modules/code.ts`
**Input:** `--src-dir`-Pfad + bestehende Findings aus Phase 1+2
**Output:** Angereicherte Findings + neue `UnifiedFinding[]`

Diese Phase hat zwei Teilaufgaben:

#### 3a. Code-Anreicherung bestehender Findings

Bestehende Findings aus axe-core und Playwright enthalten CSS-Selektoren, aber keine Dateipfade. Die Anreicherung sucht im Quellcode nach diesen Selektoren:

1. Alle `.ts`, `.tsx`, `.js`, `.jsx`-Dateien im `src/`-Verzeichnis werden rekursiv eingelesen (unter Ausschluss von `node_modules/` und `.git/`)
2. Aus dem `selector`-Feld eines Findings werden Suchbegriffe extrahiert (IDs, aria-labels, CSS-Klassen)
3. Literale Suche in den eingelesenen Dateien
4. Bei Treffer: `componentPath`, `codeSnippet` (±5 Zeilen Kontext) und `lineRange` werden im Finding ergänzt

#### 3b. Eigenständige Pattern-Findings

Zusätzlich werden 6 Code-Patterns per RegExp gesucht, die häufige Barrierefreiheitsprobleme in React-Code erkennen:

| Pattern | Beschreibung | Severity | WCAG | Kategorie |
|---------|-------------|----------|------|-----------|
| `div-span-onclick` | `<div>` oder `<span>` mit onClick ohne Keyboard-Handler | serious | 2.1.1 (A) | semantisch |
| `img-missing-alt` | `<img>` ohne `alt`-Attribut | critical | 1.1.1 (A) | syntaktisch |
| `label-missing-htmlfor` | `<label>` ohne `htmlFor` | serious | 1.3.1, 4.1.2 (A) | syntaktisch |
| `role-button-non-semantic` | `role="button"` auf Nicht-Button-Elementen | moderate | 2.1.1, 4.1.2 (A) | semantisch |
| `tabindex-removes-element` | `tabIndex={-1}` entfernt aus Tab-Reihenfolge | moderate | 2.1.1 (A) | semantisch |
| `autofocus-usage` | `autoFocus` kann Fokusfluss stören | minor | 2.4.3 (A) | semantisch |

**Deduplizierung:** Pattern-Findings werden nach `ruleId + componentPath + startLine` dedupliziert, um Mehrfachtreffer für dasselbe Problem zu vermeiden.

**Plattformunabhängigkeit:** Die gesamte Code-Analyse nutzt Node.js-natives `fs.readFileSync` und `RegExp` statt `child_process.execFile("grep")`. Damit läuft die Pipeline auf Windows, macOS und Linux ohne externe Abhängigkeiten.

### Phase 4: Prompt Builder

**Modul:** `src/prompt.ts`
**Input:** Alle normalisierten Findings + Ziel-URL
**Output:** `BuiltPrompt` (System-Prompt + User-Prompt + Metadaten)

#### Prompting-Strategien

Der Prompt kombiniert drei Strategien:

1. **Role-Play Prompting:** Das LLM wird als erfahrener Barrierefreiheitsexperte für React/TypeScript-Webanwendungen adressiert. Das etabliert den fachlichen Kontext und die erwartete Antwortqualität.

2. **Structured Output:** Ein striktes Ausgabeformat mit zwei Abschnitten (Must-have / Nice-to-have) und festen Feldern (WCAG, Schweregrad, Element/Datei, Problem, Fix) wird vorgegeben. Das reduziert die Varianz der Ausgabe und ermöglicht maschinelles Parsing.

3. **Few-Shot Prompting:** Zwei konkrete Beispiele zeigen dem Modell die erwartete Transformation:
   - Beispiel 1 (Must-have): axe-core Finding → Farbkontrast-Eintrag mit konkretem Fix
   - Beispiel 2 (Nice-to-have): grep Finding → tabIndex-Eintrag mit Kontext-Abwägung

   Zwei Beispiele decken beide Ausgabepfade ab und demonstrieren dem Modell den Unterschied in Tonalität (Must-have = dringend, Nice-to-have = abwägend).

#### Token-Budget-Management

Das Kontextfenster von qwen2.5-coder:7b beträgt 32.768 Tokens. Die Budget-Logik verteilt die verfügbaren Tokens:

```
Gesamtbudget:           32.768 Tokens
- Reserviert (Output):   8.192 Tokens
- System-Prompt:         ~900 Tokens (dynamisch berechnet)
= Verfügbar für Input:  ~23.676 Tokens
```

**Prioritätsbasierte Truncation:**
1. Alle Findings werden nach Severity sortiert (critical → serious → moderate → minor)
2. Findings werden einzeln serialisiert und dem Prompt hinzugefügt
3. Sobald das Token-Budget erreicht ist, werden verbleibende Findings (typischerweise moderate/minor) weggelassen
4. Critical- und Serious-Findings haben Vorrang — sie werden immer eingeschlossen, solange das Budget reicht

Die Token-Schätzung basiert auf der Heuristik `Math.ceil(text.length / 3.5)`, die für gemischten Deutsch/Code-Text eine ausreichende Näherung darstellt.

### Phase 5: Ollama LLM

**Modul:** `src/ollama.ts`
**Input:** `BuiltPrompt`
**Output:** `LlmResult` (Rohtext + Token-Zählung + Dauer)

1. HTTP-POST an `localhost:11434/api/generate` (Ollama API)
2. Parameter: `model: "qwen2.5-coder:7b"`, `temperature: 0.1`, `num_predict: 8192`, `stream: false`
3. Timeout: 10 Minuten (lokale Inferenz auf Consumer-Hardware)
4. Ollama liefert in der Antwort: `prompt_eval_count` (tatsächliche Prompt-Tokens) und `eval_count` (Output-Tokens)
5. Diese werden mit der Schätzung aus Phase 4 verglichen (Metriken)

**temperature = 0.1:** Niedrig gewählt für konsistente, faktenbasierte Ausgabe. Das LLM soll Findings priorisieren, nicht kreativ interpretieren.

**Kein Streaming:** Die Pipeline wartet auf die vollständige Antwort, da der Output als Ganzes geparst und in den Report geschrieben wird.

### Phase 6: Output Formatter

**Modul:** `src/output.ts`
**Input:** LLM-Ergebnis + Prompt-Metadaten + Pipeline-Metriken
**Output:** Markdown-Report + JSON-Report in `results/`

#### Markdown-Report
- Metadaten-Tabelle (URL, Datum, Modell, Dauer, Finding-Zahlen, Token-Verbrauch)
- Warnhinweise bei Token-Truncation oder Parse-Fehlern
- Vollständige LLM-Antwort (die priorisierte To-Do-Liste)
- Pipeline-Metriken (Laufzeit pro Phase, Token-Vergleich, Anreicherungsquote)

#### JSON-Report (maschinenlesbar)
```typescript
interface AnalysisReport {
  version: "1.1";
  timestamp: string;
  targetUrl: string;
  model: string;
  stats: {
    findings: { axe: number; playwright: number; grep: number };
    includedInPrompt: { axe: number; playwright: number; grep: number };
    estimatedInputTokens: number;
    actualPromptTokens: number;
    actualOutputTokens: number;
    durationMs: number;
    tokensBudgetTruncated: boolean;
  };
  metrics: PipelineMetrics;
  parsed: { success: boolean; mustHaveCount: number; niceToHaveCount: number };
  rawLlmResponse: string;
}
```

#### Parsing der LLM-Antwort
Der Formatter versucht, die LLM-Antwort in Must-have und Nice-to-have-Abschnitte zu parsen (Regex auf `## Must-have` / `## Nice-to-have` Überschriften, dann `### [ID]` Unterabschnitte). Bei Parsing-Fehlern wird die Rohausgabe gespeichert und `parsed.success: false` gesetzt.

---

## 5. Pipeline-Metriken

Jeder Durchlauf erfasst automatisch folgende Metriken für die Evaluation:

### Laufzeit pro Phase
| Metrik | Beschreibung |
|--------|-------------|
| `axeMs` | Dauer der axe-core-Analyse (Browser-Start + Navigation + axe-Ausführung) |
| `playwrightMs` | Dauer aller 7 Playwright-Checks |
| `codeEnrichMs` | Dauer der Code-Anreicherung |
| `codePatternMs` | Dauer der Pattern-Finding-Suche |
| `promptBuildMs` | Dauer des Prompt-Builders (Sortierung + Serialisierung + Token-Budgetierung) |
| `llmMs` | Dauer des LLM-Aufrufs (Prompt-Verarbeitung + Inferenz) |
| `outputMs` | Dauer der Report-Generierung |
| `totalMs` | Gesamtlaufzeit der Pipeline |

### Token-Vergleich
| Metrik | Beschreibung |
|--------|-------------|
| `estimated` | Geschätzte Input-Tokens (Heuristik: `text.length / 3.5`) |
| `actualPrompt` | Tatsächliche Prompt-Tokens (von Ollama gemeldet) |
| `actualOutput` | Tatsächliche Output-Tokens |

### Anreicherung und Deduplizierung
| Metrik | Beschreibung |
|--------|-------------|
| `enrichedCount` / `totalEnrichable` | Wie viele Findings mit Quellcode angereichert wurden |
| `beforeDedup` / `afterDedup` | Pattern-Findings vor und nach Deduplizierung |

---

## 6. Projektstruktur

```
ACE/
├── .env                          # Konfiguration (OLLAMA_MODEL, TARGET_URL, ...)
├── CLAUDE.md                     # Projektdokumentation
├── package.json                  # Dependencies und Scripts
├── tsconfig.json                 # TypeScript-Konfiguration (CommonJS, ES2022)
├── docs/
│   └── architektur.md            # Dieses Dokument
├── src/
│   ├── index.ts                  # Pipeline-Orchestrierung + CLI
│   ├── types.ts                  # UnifiedFinding, PipelineMetrics, AceCheckDefinition
│   ├── config.ts                 # Konfiguration aus .env + Defaults
│   ├── prompt.ts                 # Prompt Builder + Token-Budget + Few-Shot
│   ├── ollama.ts                 # HTTP-Client für Ollama
│   ├── output.ts                 # Markdown + JSON Report-Generierung
│   └── modules/
│       ├── axe.ts                # axe-core Collector + Normalizer
│       ├── playwright.ts         # 7 ACE-Checks + Normalizer
│       └── code.ts               # Code-Anreicherung + Pattern-Findings
└── results/                      # Generierte Reports (gitignored)
```

---

## 7. Konfiguration

Alle Konfigurationswerte werden aus Umgebungsvariablen gelesen (`.env`-Datei via dotenv), mit Defaults in `src/config.ts`:

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `TARGET_URL` | `http://localhost:3000` | URL der zu analysierenden Webanwendung |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama-API-Endpunkt |
| `OLLAMA_MODEL` | `qwen2.5-coder:7b` | LLM-Modell (muss in Ollama verfügbar sein) |

Weitere Konfiguration (axe-Tags, Playwright-Timeouts, Headless-Modus) ist in `config.ts` als Konstanten definiert.

---

## 8. CLI-Schnittstelle

```bash
# Vollständige Pipeline
npm run analyze -- --url http://localhost:3000 --src-dir /pfad/zum/src

# Prompt speichern ohne LLM-Aufruf (zum Debuggen des Prompts)
npm run analyze -- --url http://localhost:3000 --skip-llm

# Nur axe-core (schneller Rauchtest)
npm run analyze -- --url http://localhost:3000 --axe-only
```

| Flag | Beschreibung |
|------|-------------|
| `--url <url>` | Ziel-URL (überschreibt `TARGET_URL` aus `.env`) |
| `--src-dir <path>` | Pfad zum `src/`-Verzeichnis der React-App (aktiviert Code-Anreicherung + Pattern-Findings) |
| `--skip-llm` | Prompt in `results/` speichern, Ollama-Aufruf überspringen |
| `--axe-only` | Nur axe-core ausführen, Pipeline danach beenden |

---

## 9. Designentscheidungen

| Entscheidung | Alternative | Begründung |
|-------------|-------------|-----------|
| Single Combined Prompt | Multi-Step Re-Prompting (AccessGuru) | Latenz lokaler Modelle; Auditierbarkeit (ein Prompt = nachvollziehbar) |
| RegExp-Pattern statt AST | ESLint-Plugin, Babel-AST | Scope-Begrenzung; plattformunabhängig; für PoC ausreichend |
| axe einmalig statt pro Zustand | axe nach jeder Playwright-Interaktion | NFA-02 Laufzeitbudget (≤ 10 min); 14–21 zusätzliche Durchläufe × 3–8s = zu langsam |
| temperature 0.1 | Höhere temperature | Konsistente, faktenbasierte Priorisierung statt kreativer Interpretation |
| Zwei Browser-Instanzen | Shared Browser-Context | Modulare Trennung (axe und Playwright sind unabhängige Module); Vereinfachung |
| Node.js File-I/O statt grep | child_process + grep | Windows-Kompatibilität; keine externe Abhängigkeit |

---

## 10. Bekannte Limitierungen

| Limitation | Auswirkung | Verweis |
|-----------|-----------|---------|
| axe-core läuft einmalig, nicht pro Zustandsänderung | DOM-Probleme nach Interaktion (z.B. Modal öffnen) werden nicht erkannt | FA-02, NFA-02 |
| Pattern-Matching per RegExp statt AST | False Positives bei dynamischem JSX (z.B. conditional rendering) | Ausblick: AST-Analyse |
| Fokus-Visible prüft nur outline/box-shadow | Fokusindikatoren via border, background oder Pseudo-Elemente werden nicht erkannt | Playwright-API-Limitation |
| Keyboard-Trap-Heuristik | False Positives bei wenigen interaktiven Elementen (natürlicher Fokusfzyklus) | Heuristik-basiert |
| Keine semantische Validierung des LLM-Outputs | LLM könnte theoretisch Findings erfinden trotz Prompt-Regel 6 | Soft-Constraint |
| Token-Schätzung ist eine Heuristik | Abweichung zur tatsächlichen Tokenisierung (wird in Metriken erfasst) | Vergleich in Report |
