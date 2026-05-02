Wissenschaftliche Quellen fuer 2.4.4

Fatallah taxonomie Grafik Änderung prüfen

Fragen ob jetzt alles Besser ist

Abschnitt 4.3.3 (S. 26)„Die Bewertung wird durch den Autor selbst durchgeführt und nicht durch unabhängige Gutachter validiert." Halber leerer Block mit großem Whitespace folgtKorrekt eingestanden, aber zu kurz reflektiert. Inter-Rater-Reliabilität fehlt komplett, obwohl du eine 3-stufige qualitative Skala vergibst
Eine zusätzliche Stichproben­validierung mit einem zweiten Bewerter (z. B. dem Betreuer) für 10 Findings oder ein expliziter Hinweis, dass die Bewertungsskala (Tab. 19) durch ihre objektivierbaren Kriterien (Datei + Zeile + Code-Snippet vorhanden ja/nein) inter-subjektiv weitgehend reproduzierbar ist


Fn 102 (S. 16): „GPT-4o, geschätzt über 200 Mrd. Parameter"Die Zitation verweist auf Fathallah/He/Huang – keine dieser Quellen nennt die GPT-4o-Parameterzahl tatsächlich. Es gibt keine öffentliche, belastbare Zahl zu GPT-4o

Mehrere Stellen (z. B. S. 1 Fn 3, S. 17 Fn 102, S. 18 Fn 113–116)Internetquellen für zentrale Aussagen, wo Standardwerke existieren: WHO-Webseite (16 % Behinderung weltweit – steht auch im World Report on Disability), BMDS-Webseite zu digitaler Souveränität, BITBW-WebseiteGenau der Punkt aus PA2: „Auswahl an Internetquellen im Vergleich zu Standardwerken […] zu unausgewogen" – die Einleitung trifft den Prüfer als ErstesMind. drei Internetquellen durch peer-reviewed Quellen ersetzen oder ergänzen (z. B. WHO/World Bank World Report on Disability statt who.int/disability; Heinemann 2024 ist bei dir schon zitiert – mehr nutzen). Siehe E für Liste

Tabelle 12 (S. 59) – AblationsanalyseBedingung B („Stufe-2-Priorisierer ohne LLM-Detektor") ist nur architekturell abgeleitet, nicht empirisch gemessen; die ganze TF2 stützt sich auf eine Partialablation auf test-12Methodisch ist eine architekturelle Ableitung plausibel, aber kein Ablations-Beweis. Der Prüfer kann „kritische Distanz" einfordern, an genau dieser Stellea) Sehr klein: explizit „Strukturablation" statt „Ablationsanalyse" benennen; b) optional ein zusätzlicher Lauf mit ausgeschaltetem --llm-detect auf test-50 reicht für eine echte empirische Bestätigung, max. 1 Tabellenzeile zusätzlich

Abb. 1 (S. 8) vs. Text S. 7Im Text steht „87 testbare Erfolgskriterien" (= WCAG 2.2 mit Minimalfehler – tatsächlich 86), die Abbildung zeigt „78 Erfolgskriterien" (= WCAG 2.1) mit Caption „in WCAG 2.2 strukturell unverändert"Innere Inkonsistenz; Caption ist unscharf, da die Anzahl der Kriterien in 2.2 nicht unverändert istEines von beiden korrigieren: entweder Abbildung auf WCAG 2.2 (86 Kriterien) anpassen ODER Text/Caption präziser: „In der Anzahl der Erfolgskriterien unterscheidet sich WCAG 2.2 (86) von WCAG 2.1 (78); die hierarchische Schichtenstruktur bleibt strukturell unverändert."

// Kapitel 3.1 „Vorgehen der Literaturrecherche" (8 Zeilen)Zu kurz für eine BA. Du nennst die Datenbanken (ACM/IEEE/ScienceDirect/arXiv) und Suchbegriffe, aber keine Inklusions-/Exklusions­kriterien, keine Trefferzahlen, kein PRISMA-/Webster-Watson-Schema explizit„Vorgehen der Literaturrecherche" ist ein Standardprüfziel der DHBW; zumal in Kap. 3 schon Webster/Watson zitiert wird5 Zeilen mehr: konkrete Suchstrings, Trefferzahl pro DB, Inklusions-/Exklusionskriterien (z. B. „nur 2018–2026", „LLM/AI-Bezug", „peer-reviewed"). Im Anhang 3 hast du die volle Konzeptmatrix – darauf hier expliziter verweisenMittelMittel


Internetquellen, die durch wissenschaftliche Quellen ersetzt/ergänzt werden sollten:

World Health Organization (2026) (Fn 3) → besser: WHO/World Bank (2011): World Report on Disability oder neuere offizielle WHO-Berichte als PDF.
Stack Overflow Survey 2025 (Fn 78) → akzeptabel als praxisnahe Sekundärquelle, aber zumindest mit Datenpunkt-Beleg im Anhang verknüpfen.
BMDS Webseiten 2025a/b (Fn 113–116) → ergänzen mit Goldacker (2017) Digitale Souveränität (Fraunhofer FOKUS) oder einem Artikel aus Verwaltung & Management / DÖV zur digitalen Souveränität.
BITBW (2021) (Fn 11) → akzeptabel, da praxisbezogener Kontext, aber an einer Stelle reicht; mehrfach genutzt.
Robie 2026 (DOM) (Fn 53) → besser: Flanagan 2020 (hast du schon!) – nur Re-Zitat reicht.
Anthropic 2026a/b, OpenAI 2026 (zu Temperature, Halluzination) (Fn 99–101, 173) → Hersteller­dokumentation als technischer Beleg ist OK, aber die wissenschaftliche Aussage zur Halluzination ist auch über Huang, L. et al. 2025 (hast du!) belegbar – an dieser Stelle stärker auf Huang stützen.
Ollama 2026 (Fn 175) → unkritisch, da reines Tool.


Fehlende Quellen / unbelegte Aussagen:

S. 16: „GPT-4o, geschätzt über 200 Milliarden Parameter" – die zitierten Quellen (Fathallah, He, Huang) belegen diese Zahl nicht. Aussage abschwächen oder mit echter Sekundärquelle belegen (es gibt keine öffentliche Zahl).
S. 27 Fn 161 + Fn 162 (gleicher Hevner/Chatterjee-Beleg zweimal direkt nacheinander): einer ist redundant.
Abschnitt 8.4.1: „qwen3:32b erreicht für 11 von 12 Violations Stufe 2" – hier wäre ein Fußnoten-Verweis auf Tab. 33 sinnvoll, aktuell nur im Fließtext.
Abschnitt 8.5.2: „σ = 3,28" / „σ = 0,42" – Tabellenverweis (Tab. 32) fehlt im Fließtext, würde Lesefluss helfen.

Aussagen ohne Beleg (geprüft, sollten Fußnote bekommen):

S. 12 „im Vergleich zu klassischen serverseitig gerenderten Anwendungen werden bei einer SPA […]": Sommerville oder eine SPA-Definition (z. B. Mikowski/Powell, Single Page Web Applications) wäre sauber.
S. 28 „Praxisanforderung BITBW" als Quellenangabe in Tab. 4 → Hinweis auf das Gesprächsdokument im Projekt-Knowledge wäre möglich (intern, in Anhang verweisen).



Chaty Feedback: BWEC konsequent als Praxisrahmen/qualitative Erprobung formulieren, nicht als tragende Fallstudienevaluation.

5–8 kritische Fußnoten prüfen/ersetzen/abschwächen; besonders BFSG, öffentliche Verwaltung, “kein bekannter Ansatz”, React-Dominanz.

Kapitel 3.5 / Forschungslücke
“Kein bekannter Ansatz kombiniert …” ist sehr stark.
Bei schnelllebiger LLM-Forschung ist “kein bekannter Ansatz” angreifbar.
“Nach Auswertung der in Kapitel 3 betrachteten Literatur wurde kein Ansatz identifiziert, der …”

Literaturverzeichnis
“Deutscher Bundestag 2026: BFSG” mit URL bfsg-gesetz.de wirkt nicht wie eine offizielle Bundestagsquelle.
Juristische Quellen sollten extrem sauber sein.
Offizielle Normquelle verwenden, z. B. Gesetze-im-Internet / BGBl. / zuständiges Ministerium.

Kapitel 4 Methodik
DSR + Fallstudienansatz: BWEC als Einzelfallstudie, aber Hauptevaluation läuft auf synthetischen Suites.
Methodisch kann der Prüfer fragen: Ist das wirklich Fallstudie oder nur Praxisrahmen?
“Der BWEC dient als Praxis- und Demonstrationskontext; die quantitative Evaluation erfolgt kontrolliert an synthetischen Testsuiten.”

E. Quellen- und Fußnotenprüfung

Ich würde diese Stellen vor Abgabe gezielt prüfen:

Heinemann 2024, S. 281 vs. S. 469–488
Das ist für mich der auffälligste konkrete Fußnotenpunkt. Wenn der Beitrag im Literaturverzeichnis S. 469–488 umfasst, wirkt S. 281 falsch oder zumindest erklärungsbedürftig.
BFSG-Quelle “Deutscher Bundestag 2026”
Die Quellenangabe wirkt nicht sauber genug, weil die URL nicht wie eine offizielle Bundestags- oder Gesetzesdatenbank aussieht. Gerade bei Rechtsthemen besser offizielle Gesetzesquellen verwenden.
Aussage zur BITBW und BFSG-Pflicht
Nicht unbedingt falsch, aber zu pauschal. Für öffentliche Verwaltung sollte BITV/BGG stärker im Vordergrund stehen; BFSG vorsichtiger und kontextabhängig formulieren.
Aussage zu öffentlichen Webangeboten im Vergleich zu WebAIM
Hier brauchst du entweder eine Quelle, die wirklich öffentliche Seiten vergleichbar untersucht, oder du schwächst den Vergleich ab.
“Bestehende automatisierte Prüfwerkzeuge erfassen lediglich syntaktische Verstöße” im Abstract
Inhaltlich verständlich, aber zu absolut. Besser: “erfassen vor allem regelbasiert prüfbare Verstöße und stoßen bei semantischen sowie zustandsabhängigen Barrieren an Grenzen.”
“Kein bekannter Ansatz kombiniert …”
Besser methodisch sauber begrenzen: “In der ausgewerteten Literatur wurde kein Ansatz identifiziert …”
Stack Overflow Survey für React-Dominanz
Als Kontext okay, aber nicht als starke wissenschaftliche Begründung. Wenn die Aussage nur Nebeninformation ist, passt es. Wenn du daraus Relevanz ableitest, ergänze/ersetze mit wissenschaftlicher oder industrieller Sekundärquelle.
Hersteller-/Dokumentationsquellen bei OpenAI, Anthropic, Ollama, Playwright, axe-core
Für technische Eigenschaften okay. Für wissenschaftliche Aussagen zu Leistungsfähigkeit, Datenschutzrisiken oder Halluzinationen sollten eher Papers/System Cards/Surveys verwendet werden.
OpenAI API / Anthropic API als Datenschutzargument
Inhaltlich plausibel, aber juristisch besser nicht zu pauschal. Besser: “kann je nach Datenart, Auftragsverarbeitung, Drittlandtransfer und Organisationsvorgaben problematisch sein.”