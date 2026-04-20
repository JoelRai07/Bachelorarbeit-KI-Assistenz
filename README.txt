Prüfen auf Seitenanzahl:
- brown2020gpt3fewshot
- yao2022react
- wei2022chainofthought
-lewis

Ok du bist nun mein Betreuer meiner Bachelorarbeit, lese diese vollständig auch den Anhang und gebe mir Vorschläge und Tips (ja ich weiß der BWEC fehlt, der kommt diese Woche noch) (ich bin auch schon über die vorgegebenen 60 Seiten (Zurzeit bei 69 glaube ich)). Außerdem korrigiere Fehler wo ich etwas behaupte was nicht so ist. Und untersuche auch wo man noch was zitieren soll oder kann? @1.tex @2.tex @3.tex @4.tex @5.tex @6.tex @7.tex @8.tex @anhang.tex

Bewerte meine Arbeit. Das ist meine vollständige Bachelorarbeit (eigentlich nicht vollständig weil ich über dem Limit bin). Gebe mir auch eine Gesamtnote und oder Noten für jedes Kapitel. Sei objektiv und ehrlich. Was kann ich noch besser machen? Ist das, das niveaou einer Bachelorarbeit?


Fehlervergleich 
Anhang 64 Missleading
Plausibilisierung 
Fazit: Plausibilisierung oder Manuelle Überprüfung
Überdetektion -> Probleme? Glätten? Usw. Evntll. text addressieren
Warum nicht einfach automatisch zusammenführen?
Weil man dabei echte Treffer verlieren kann.
Wenn zwei ähnlich klingende Befunde fälschlich gemerged werden, verschwindet evtl. ein relevanter Hinweis.
Das wäre ein False Negative (ein echtes Problem wird nicht mehr gemeldet).

Kommentieren den Prüfer
- Seitenanzahl
- Englische Fachbegriffe: Die Zitierrichtlinien sagen in Abschnitt 1.3 zwar, dass „entbehrliche Fremdwörter zu vermeiden" seien, und Abschnitt 1.11 empfiehlt, Fachbegriffe „im Text an der betreffenden Stelle oder in einer Fußnote" zu erläutern. Aber: In einer Wirtschaftsinformatik-Arbeit sind Begriffe wie Recall, Precision, Pipeline, Baseline und Parsing keine „entbehrlichen Fremdwörter" — das ist etablierte Fachterminologie, für die es teilweise gar keine sinnvolle deutsche Entsprechung gibt. „Trefferquote" für Recall oder „Datenverarbeitungskette" für Pipeline wäre eher verwirrend als hilfreich.
- Erläuterung der "Eigenen Abbildung"

Screenshot entfernen aus Anhang,
Abbildung mit den Phasen in Kapitel 1 verbessern, schärfer machen
Eventuell Datenflussdiagramm des Programms wieder zurückbringen

Anhang verbessern
2. Drei Datenquellen in der Einleitung, vier Analysequellen später
3. Fokus-Trap, Keyboard-Trap und Fokusübernahme werden vermischt
4. grep-Patterns passen nicht sauber zu deinen Suites
6. „Erwartete Quelle“ und „tatsächliche Quelle“ passen teilweise nicht zusammen
Mittlere, aber sinnvolle Nachschärfungen

Diese Punkte sind kleiner, würden die Arbeit aber noch souveräner machen:

Violation / Finding / Report-Item einmal sauber definieren.
Im Moment wechselst du zwischen den Begriffen etwas frei.
Im Fazit würde ich TF1 nicht zu stark als vollständig bestätigt formulieren, sondern eher:
„differenziert beantwortet“ oder „weitgehend bestätigt“
Bei den BWEC-Abschnitten noch klarer trennen:
explorativer Feldtest vs. Ground-Truth-basierte Hauptevaluation


