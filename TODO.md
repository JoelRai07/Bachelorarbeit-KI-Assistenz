# TODOs Betreuer-Feedback

## Offen — erst nach Rücksprache mit Betreuer

- [ ] **Datenschutz-Abschnitt (Kap. 2) umbauen**
  - Aktuelles Argument ("personenbezogene Daten könnten im Quellcode enthalten sein") ist schwach
  - Neuer Fokus: **digitale Souveränität** — öffentlicher Dienst hat Interesse daran, Datenabfluss auf ausländische Server (v.a. USA) zu verhindern
  - Quellen beschaffen: BSI-Richtlinien zur Cloud-Nutzung, US Cloud Act, EU/Bundesregierung zu digitaler Souveränität
  - Nach Umbau: alle Verweise auf dieses Argument prüfen (Kap. 1.1, Kap. 4, Kap. 6) und konsistent anpassen

- [ ] **UFS-Darstellung (Kap. 5): Idee für Betreuer — Option B**
  - Statt des TypeScript-Interface-Listings (aktuell im Anhang) eine **kompakte Tabelle** mit den drei Feldgruppen einbauen:
    - Identifikation & Klassifikation: `id`, `source`, `ruleId`, `severity`, `category`
    - WCAG-Bezug: `wcagCriteria`, `wcagLevel`
    - Quellcode-Kontext: `selector`, `componentPath`, `codeSnippet`, `lineRange`
  - Vorteil: konzeptueller, weniger Implementierungsdetail, bleibt in Kap. 5
  - Rücksprache mit Betreuer, ob das besser als reiner Anhang-Verweis ist
