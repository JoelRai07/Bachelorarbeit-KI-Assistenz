# ACE — Notizen & Nächste Schritte

## Was der PoC macht (Kurzfassung)

**Drei Werkzeuge analysieren die App → Ergebnisse werden zusammengefasst → LLM schreibt To-Do-Liste**

1. **axe-core** — startet echten Browser, analysiert den gerenderten DOM auf WCAG-Verletzungen
2. **Playwright** — führt 7 generische Accessibility-Checks aus (Tastatur, Fokus, etc.) — keine App-spezifischen Klick-Skripte nötig, läuft auf jeder Web-App
3. **grep** — sucht im React-Quellcode nach Mustern UND verknüpft DOM-Violations mit der konkreten Datei+Zeile

Danach: alle Findings → Prompt → Ollama → priorisierte Empfehlungsliste (Must-have / Nice-to-have)

**Wichtig:** Ollama analysiert keinen Code selbst. Es liest was die drei Werkzeuge gefunden haben (inkl. Code-Snippets von grep) und formuliert daraus entwicklergerechte Vorschläge. Ohne den grep-Kontext wären die Vorschläge generisch ("Füge aria-label hinzu"). Mit Kontext: "In `LoginForm.tsx` Zeile 42: Füge `aria-label='Anmelden'` hinzu."

---

## Was "kontextsensitiv" bedeutet

Traditionelle Scanner sagen: *"Element X hat Problem Y."*
Dein PoC sagt: *"Element X hat Problem Y — hier ist der Code wo es definiert ist, und hier ist der Fix."*

Der "Kontext" = DOM-Problem + Interaktionsverhalten + Quellcode gleichzeitig im LLM-Prompt.

---

## Was den PoC einzigartig macht (für die Thesis!)

| Tool | axe/DOM | Playwright | Code-Kontext | Lokales LLM |
|------|---------|-----------|--------------|-------------|
| pa11y / axe-playwright | ✅ | ✅ | ❌ | ❌ |
| AccessGuru (Fathallah 2025) | ✅ | ❌ | ❌ | ❌ (Cloud) |
| **Dein PoC** | ✅ | ✅ | ✅ | ✅ |

**Alleinstellungsmerkmal:** grep-Anreicherung (Code-Kontext) + lokales LLM. Nicht Playwright allein — das machen andere auch.

**Warum lokal wichtig ist:** BITBW/öffentliche Verwaltung darf keine Daten an Cloud-APIs schicken. Ollama = 100% lokal = einzige konforme Lösung.

---

## Was der PoC am Rich-Client-Problem löst

| Problem | Was es bedeutet | Status |
|---------|----------------|--------|
| Dynamisches DOM | React rendert per JS — HTML-Scanner sehen nichts | ✅ Gelöst (Browser-Launch) |
| Komponenten-Mapping | "Button X hat Fehler" — aber wo im Code? | ✅ Gelöst (grep-Anreicherung) |
| Zustandsabhängige Violations | Fehler die erst nach Klick entstehen | ⚠️ Teilweise (7 Playwright-Checks) |

---

## Was in dieser Session umgesetzt wurde

- `temperature: 0.3` → `0.1` in `ollama.ts` (NFA-04 Alignment)
- Neues Feld `category: "syntaktisch" | "semantisch" | "layout"` in `UnifiedFinding` (FA-05)
- Alle drei Normalizer (axe, playwright, code) befüllen `category`
- `Claude.md` stark erweitert mit Thesis-Schreibhinweisen, Kapitelstruktur, Abweichungstabelle

---

## Das Testproblem — und die Lösung

**Problem:** BWEC Client ist schon weitgehend barrierefrei → wenige Findings → schwache Evaluation.

**Lösung: Synthetische Testkomponente bauen**

Eine kleine React-Seite mit ~10 bewusst eingebauten Fehlern (fehlende alt-Attribute, schlechter Kontrast, onClick ohne Keyboard-Handler, etc.). Vorteile:
- Du weißt exakt welche Findings erwartet werden → Precision/Recall messbar
- Reproduzierbar für den Modellvergleich
- Akademisch sauber: *"kontrollierte Evaluationsumgebung"*

BWEC-Testing läuft zusätzlich als **Real-World-Validierung** — zeigt dass das System in Produktion stabil läuft und keine False-Positive-Flut erzeugt.

**Formulierung für Kap. 7:**
> *"Um eine reproduzierbare Evaluation zu ermöglichen, wurde ein synthetisches Testobjekt entwickelt, das WCAG-Verletzungen aller drei Kategorien (syntaktisch, semantisch, layout) gezielt abbildet."*

---

## Modellvergleich — Nächster Schritt

**Hardware:** 96 GB RAM, kein dedizierter VRAM → CPU-only Inference

| Modell | RAM (Q4) | Besonderheit |
|--------|----------|--------------|
| `qwen2.5-coder:7b` | ~5 GB | Aktuell im Einsatz, Baseline |
| `qwen2.5-coder:14b` | ~9 GB | Direkter Vergleich, selbe Familie |
| `qwen3:32b` | ~20 GB | **Top-Empfehlung** — Reasoning + Code |
| `deepseek-r1:32b` | ~20 GB | Stark für Analyse, erklärt Denkschritte |
| `deepseek-r1:70b` | ~45 GB | Maximale Qualität wenn Zeit keine Rolle |

**Empfohlener Vergleich für Thesis:** `qwen2.5-coder:7b` vs. `qwen3:32b`
- Vergleicht nicht nur Größe sondern auch Architektur-Generation
- qwen3 hat Thinking-Modus → konkretere Empfehlungen erwartet
- NFA-02 auf 20 min erhöht → 32b auf CPU realistisch

**Modell wechseln:** nur `OLLAMA_MODEL` in `config.ts` oder als Env-Var setzen — sonst nichts ändern.

```bash
OLLAMA_MODEL=qwen3:32b npm run analyze -- --url http://localhost:3000
```

**Für den Vergleich:** gleichen synthetischen Test mit beiden Modellen laufen lassen, Outputs nebeneinander stellen, qualitativ bewerten (Konkretheit, Korrektheit des Fix-Vorschlags).

---

## Thesis-Checkliste

### Kapitel 6 (Implementierung) — ausbauen
- [ ] Projektstruktur + Tech Stack
- [ ] UFS erklären inkl. `category`-Feld (Taxonomie nach Fathallah)
- [ ] axe-Modul: Browser-Launch, AxeBuilder, category-Heuristik
- [ ] Playwright-Modul: 7 Checks Tabelle mit WCAG-Mapping
- [ ] Code-Modul: grep-Strategie, 6 Pattern-Katalog, Anreicherungslogik
- [ ] Prompt Builder: Token-Budget-Logik erklären
- [ ] Ollama-Client: temperature=0.1 begründen (NFA-04)

### Kapitel 7 (Evaluation) — Kern der Arbeit
- [ ] Synthetische Testkomponente bauen (10+ bewusste Violations)
- [ ] Precision/Recall messen
- [ ] Laufzeitmessungen pro Phase dokumentieren (axe, Playwright, grep, LLM)
- [ ] Modellvergleich: 7b vs. qwen3:32b — Output-Qualität bewerten lassen
- [ ] FA-02 Limitation begründen (NFA-02 Budget → axe einmalig statt pro Zustand)
- [ ] BWEC Real-World-Test als ergänzende Validierung

### Kapitel 8 (Diskussion) — ausbauen
- [ ] Forschungsfragen beantworten
- [ ] Vergleich mit AccessGuru (Gemeinsamkeiten/Unterschiede)
- [ ] Übertragbarkeit auf andere SPAs

### Kapitel 9 (Fazit) — ausbauen
- [ ] Zusammenfassung der Ergebnisse
- [ ] Ausblick: axe pro Zustand, AST statt grep, Fine-Tuning

### Vor Abgabe
- [ ] Sperrvermerk: Bold-Text-Inline-Frage entfernen
- [ ] Abstract schreiben (nach Evaluation)
- [ ] KI-Erklärungstabelle ausfüllen
- [ ] Literaturverzeichnis: Fathallah et al. 2025 Vollreferenz prüfen

---

## FA-02: axe pro Zustand — Warum wir es nicht umsetzen

**Was es bedeutet:** axe nach jeder Playwright-Interaktion erneut ausführen um DOM-Zustände zu analysieren (z.B. Dialog-Violations die erst nach Klick sichtbar werden).

**Warum nicht:** 7 Checks × ~5s pro axe-Lauf = bis zu 35+ Sekunden allein für axe, plus LLM-Aufruf → NFA-02 verletzt.

**Akademischer Wert:** Die Entscheidung selbst ist wichtiger als die Implementierung. Zeigen dass du das Problem erkannt, analysiert und begründet abgewogen hast = genau was eine BA leisten soll.

**Formulierung für Kap. 7:**
> *"FA-02 wurde im PoC dahingehend vereinfacht, dass axe-core einmalig beim initialen Seitenaufruf ausgeführt wird. Eine Analyse nach jeder Playwright-Interaktion wäre technisch realisierbar, würde jedoch NFA-02 verletzen, da jeder axe-Durchlauf 3–8 Sekunden benötigt. Diese Einschränkung ist als Limitierung dokumentiert und stellt einen konkreten Ansatzpunkt für zukünftige Iterationen dar."*
