# ACE – Synthetische Testkomponente

Dieses Mini-Projekt ist die **kontrollierte Evaluationsumgebung** für den ACE-Proof of Concept.  
Es simuliert eine realistische Web-App (Login + Kontaktformular) mit **12 bewusst eingebauten WCAG-Violations**.

## Zweck

> „Um eine reproduzierbare Evaluation zu ermöglichen, wurde ein synthetisches Testobjekt entwickelt,
> das WCAG-Verletzungen aller drei Kategorien (syntaktisch, semantisch, layout) gezielt abbildet."

Die Violations decken alle drei `category`-Werte des Unified Finding Schema (UFS) ab und ermöglichen
die Berechnung von **Precision** und **Recall** sowie eine gestufte Bewertung der **Empfehlungsqualität**.

---

## Setup

```bash
npm install
npm run dev
# → http://localhost:5173
```

---

## Vollständige Violations-Tabelle

| #   | Violation                                  | Kategorie   | Erwartete Quelle    | WCAG  | Datei / Zeile         |
|-----|--------------------------------------------|-------------|---------------------|-------|-----------------------|
| V1  | `<img>` ohne `alt`-Attribut                | syntaktisch | axe-core            | 1.1.1 | App.tsx ~46           |
| V2  | `<button>` ohne `aria-label`               | syntaktisch | axe-core            | 4.1.2 | LoginForm.tsx ~53     |
| V3  | `<input>` ohne `<label>`                   | syntaktisch | axe-core            | 1.3.1 | LoginForm.tsx ~42     |
| V4  | Kontrast #888 auf #fff (~2.85:1)           | layout      | axe-core            | 1.4.3 | styles.css ~107       |
| V5  | `outline: none` (Fokus entfernt)           | layout      | axe-core + Playwright| 2.4.7 | LoginForm.tsx ~63, styles.css ~113 |
| V6  | `onClick` ohne `onKeyDown` auf `<div>`     | semantisch  | grep                | 2.1.1 | ContactForm.tsx ~52   |
| V7  | `role="button"` ohne `tabIndex`            | semantisch  | axe-core + grep     | 4.1.2 | ContactForm.tsx ~77   |
| V8  | Modaler Dialog ohne Fokus-Trap             | semantisch  | Playwright          | 2.1.2 | ContactForm.tsx ~85   |
| V9  | Skip-Link fehlt                            | semantisch  | Playwright          | 2.4.1 | App.tsx ~39 (Kommentar)|
| V10 | `aria-hidden="true"` auf fokussierbarem Element | syntaktisch | axe-core       | 4.1.2 | LoginForm.tsx ~66     |
| V11 | DOM-/visuelle Reihenfolge weichen ab       | semantisch  | axe-core            | 1.3.2 | App.tsx ~52, styles.css ~50 |
| V12 | Button-Größe 18×18px (< 24×24px)          | layout      | grep (CSS-Pattern)  | 2.5.8 | styles.css ~148       |

---

## Bewertungsmatrix (für Kapitel 7)

Nach dem PoC-Lauf wird jede Violation bewertet:

### Erkennungsrate

| Violation | Erkannt ✓/✗ | Quelle korrekt | False Positive | Anmerkung |
|-----------|------------|----------------|----------------|-----------|
| V1  | | | | |
| V2  | | | | |
| V3  | | | | |
| V4  | | | | |
| V5  | | | | |
| V6  | | | | |
| V7  | | | | |
| V8  | | | | |
| V9  | | | | |
| V10 | | | | |
| V11 | | | | |
| V12 | | | | |
| **∑** | **/12** | | | |

**Recall** = erkannte Violations / 12  
**Precision** = korrekte Findings / alle Findings (inkl. False Positives)

### Empfehlungsqualität (3-stufige Skala)

| Stufe | Bezeichnung | Kriterium |
|-------|-------------|-----------|
| **2** | Konkret     | Dateiname + Zeile + konkreter Fix-Vorschlag (z.B. `aria-label="Passwort"`) |
| **1** | Teilweise   | Richtiger Fix-Typ, aber ohne Codekontext |
| **0** | Generisch   | Nur Problembeschreibung, kein umsetzbarer Vorschlag |

| Violation | Stufe (0/1/2) | LLM-Output (Zusammenfassung) | Anmerkung |
|-----------|--------------|------------------------------|-----------|
| V1  | | | |
| V2  | | | |
| ...  | | | |

---

## Kategorie-Verteilung

| Kategorie   | Violations          | Anzahl |
|-------------|---------------------|--------|
| syntaktisch | V1, V2, V3, V10     | 4      |
| layout      | V4, V5, V12         | 3      |
| semantisch  | V6, V7, V8, V9, V11 | 5      |

---

## Wichtiger Hinweis

Alle Violations sind **absichtlich eingebaut** und durch Kommentare im Quellcode dokumentiert.  
Dieses Projekt ist **ausschließlich für Evaluationszwecke** im Rahmen der Bachelorarbeit bestimmt
und darf nicht als Vorlage für produktive Anwendungen verwendet werden.
