# ACE – Accessibility Companion (vereinfachte Nutzung)

ACE scannt eine laufende React-Anwendung (z.B. `sbw-feedbackformular`) mit drei Quellen:
axe-core, Playwright-Checks und grep-basierte Codepattern. Alle Ergebnisse landen in einer
priorisierten Must-have/Nice-to-have-Liste, inklusive Markdown- und JSON-Report.

## Setup

```bash
cd ACE
pnpm install          # einmalig (installiert auch die Playwright-Browser)
pnpm analyze -- --url http://localhost:5200 --src-dir ../sbw-feedbackformular/app
```

### Praktische Skripte

| Script            | Zweck |
|-------------------|-------|
| `pnpm analyze`    | Vollständige Pipeline inkl. Ollama-Aufruf |
| `pnpm prompt`     | Pipeline ohne LLM (Prompt wird unter `results/prompt-*.txt` gespeichert) |
| `pnpm axe`        | Nur axe-core, ohne LLM |
| `pnpm test:ollama`| Prüft, ob Ollama läuft und das konfigurierte Modell vorhanden ist |

`TARGET_URL`, `OLLAMA_URL`, `OLLAMA_MODEL` und `RESULTS_DIR` lassen sich per Umgebungsvariablen
überschreiben. Standardmäßig erwartet ACE einen Dev-Server unter `http://localhost:3000` und
Ollama auf `http://localhost:11434` (Modell: `qwen2.5-coder:7b`).

## Ablauf in Kürze

1. **axe-core** scannt das DOM im Headless-Chromium.
2. **Playwright** führt Tastatur-/Fokus-Checks aus.
3. **grep** reichert Findings mit Codezeilen an und meldet Pattern wie `<img>` ohne `alt`.
4. **Prompt-Builder** fasst alles in einem Prompt zusammen.
5. **Ollama** erstellt die To-Do-Liste, **Output** speichert Markdown + JSON in `results/`.

Benötigst du nur den Prompt (z.B. für Review), nutze `pnpm prompt`. Möchtest du einen bestimmten
Pfad scannen, gib `--src-dir` an (typischerweise das `app/`-Verzeichnis einer Remix-App).
