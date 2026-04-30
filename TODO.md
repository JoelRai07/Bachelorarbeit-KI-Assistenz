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



Regel~6 adressiert gezielt das in Abschnitt~\ref{kap:2.4} beschriebene Halluzinationsproblem von \ac{LLM}s. Der vollständige System-Prompt sowie die Few-Shot-Beispiele sind in Anhang~\ref{app:systemprompt} dokumentiert.

Zur Einordnung des Forschungsstands wurde eine strukturierte Literaturrecherche in wissenschaftlichen Repositorien und Datenbanken durchgeführt (u.\,a. ACM Digital Library, IEEE Xplore, ScienceDirect und arXiv).\footcite[Vgl.][]{WebsterWatson2002} Die Recherche erfolgte themenorientiert auf Basis von Suchbegriffen wie \glqq web accessibility\grqq, \glqq LLM accessibility\grqq, \glqq accessibility violation detection\grqq{} und \glqq axe-core\grqq. Berücksichtigt wurden primär aktuelle Arbeiten mit Bezug zur automatisierten Erkennung oder Behebung von Barrierefreiheitsverstößen in Webanwendungen mit \acs{KI}-Assistenzsystemen. Die identifizierten Arbeiten wurden thematisch gruppiert, priorisiert und vergleichend ausgewertet.

Ground Trouth
- Runs durch Testlaufe ersetzten

Manchmal im Fließtext und manchmal auf Bulletpoint/Nummer, mehr Konsistenz. Auflistungspunkte vllt. gut? 

Heatmap -> memorable for reader (revise other graphics)
Anker -> Brücke zwischen Theorie und Praxis
JAWS, NVDA, VoiceOver fett machen
Aufzählung in Fazit 9.3 für Mittelfristig??