# BMAD+

<div align="center">
  <a href="../README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.es.md">Español</a> | 🌐 <b>Deutsch</b>
</div>

[![Version](https://img.shields.io/badge/version-0.23.1-blue)](https://www.npmjs.com/package/bmad-plus)

**Version 0.23.1** · Node.js `>=20.0.0` · MIT

Zehn Pakete projektlokaler KI-Rollen und -Workflows (Design, SEO, GRC, OSINT, Memory) mit einem Intake, der vor dem Handeln fragt, Swarms im Budgetrahmen, sicheren Updates und Adaptern für sieben KI-Coding-Tools

[Website](https://bmad-plus.rochetta.fr/de/) · [Loslegen](https://bmad-plus.rochetta.fr/de/docs/#start) · [Beispiele](https://bmad-plus.rochetta.fr/de/docs/#examples) · [Neuigkeiten](https://bmad-plus.rochetta.fr/de/docs/#news)

BMAD+ installiert Projektanweisungen, Rollen und Workflows für das KI-Coding-Tool, das du bereits nutzt. Standardmäßig wird die Ausführung vom Host verwaltet: Dein Tool stellt das Modell, die Berechtigungen, die Befehlsausführung und gegebenenfalls parallele Agenten bereit. Nexus kann außerdem einen ausdrücklich geplanten lokalen Befehl oder Codex-CLI-Prozess unter einem Supervisor im Vordergrund starten, dessen Ergebnis festhalten und vor der Abnahme unabhängige Prüfungen verlangen. Die Berechtigungen des Hosts gelten weiterhin; es gibt weder einen Hintergrund-Scheduler noch eine universelle Integration in den Lebenszyklus des Hosts. Modellabonnements und API-Zugänge sind separat.

BMAD+ bringt zehn Pakete mit. Erst fragen: `bmad-plus intake` stellt die Fragen eines Pakets in kleinen Gruppen, schlägt Standardwerte vor, hält fest, was du nicht weißt, und erzeugt das Briefing, auf dem das Paket danach arbeitet. Swarms: `bmad-plus swarm` verteilt simulierte Einheiten, gibt jedem Sub-Agenten ein eigenes Briefing, prüft jede Antwort und zählt nur die gültigen, innerhalb eines Budgets, das du festlegst. Atelier, die Design-Engine des Design-Pakets, baut, prüft und überarbeitet Oberflächen nach überprüfbaren Regeln.

Adapter: Claude Code, Gemini CLI, Antigravity, Cursor, Codex CLI, OpenCode, Aider.

## Loslegen

Erfordert Node.js `>=20.0.0`. Optionale Pakete können zusätzliche Laufzeitumgebungen oder API-Zugänge benötigen. Führe Terminalbefehle in deinem Projektordner aus.

### 1. Projektordner öffnen

Öffne ein Terminal im Repository, an dem du arbeiten möchtest, und prüfe die Node.js-Version. Nutze weiterhin deine übliche Versionsverwaltung.

**Im Terminal deines Projekts:**

```sh
node --version
```

Die Ausgabe sollte v20 oder neuer anzeigen. Installiere oder aktualisiere Node.js bei Bedarf separat.

### 2. BMAD+ installieren und Werkzeuge wählen

Starte das Installationsprogramm. Wähle die Adapter deiner KI-Werkzeuge und die benötigten Packs. Core enthält Atlas, Forge, Sentinel und Nexus.

**Im Terminal deines Projekts:**

```sh
npx bmad-plus@0.23.1 install
```

Die Installation erstellt Agentenanweisungen, die gemeinsame Projektbasis und die gewählten Adapter. Optionale Packs können weitere Laufzeitumgebungen oder API-Zugänge benötigen.

### 3. Sitzung im selben Ordner starten

Öffne oder starte deinen KI-Coding-Assistenten im Projekt neu, damit er seinen Adapter und AGENTS.md laden kann. Frage nach den installierten Agenten und Workflows.

**In deinem KI-Assistenten:**

```text
bmad-help
```

Nach der Installation ist kein weiterer BMAD+-Initialisierungsbefehl nötig. bmad-help ist eine Nachricht an den Assistenten, kein Terminalbefehl.

### 4. Einer Rolle eine konkrete Aufgabe geben

Beschreibe Ziel, Einschränkungen und erwartetes Ergebnis. Beginne bei einer neuen Idee mit Atlas, bei einer Änderung am bestehenden Code mit Forge.

**In deinem KI-Assistenten:**

```text
Atlas, hilf mir, eine kleine Rechnungsanwendung für Selbstständige einzugrenzen. Frage nach den Nutzern, bestimme den ersten nützlichen Ablauf und schreibe ein Briefing mit Akzeptanzkriterien.
```

Prüfe das Briefing, bevor du Forge eine Story umsetzen lässt. Ein klares Ergebnis macht Fortschritte überprüfbar.

### 5. Ergebnis prüfen und Kontext sichern

Bitte Sentinel, die Änderung anhand der Akzeptanzkriterien zu prüfen. Fordere Testergebnisse und eine kurze Übergabe für die nächste Sitzung an.

**In deinem KI-Assistenten:**

```text
Sentinel, prüfe diese Änderung anhand der Akzeptanzkriterien. Überprüfe die wichtigsten Erfolgs- und Fehlerfälle, nenne offene Probleme und fasse zusammen, was die nächste Sitzung wissen muss. Wenn das BMAD+ CLI verfügbar ist, versiegle den Umfang mit bmad-plus review scope, wende die Regeln seiner Checkliste an, zitiere den Code jedes Befunds, belege jede ausgewählte Datei und berichte, was bmad-plus review gate antwortet.
```

Lies die Änderungen und Testergebnisse. Der Assistent arbeitet innerhalb der Rechte und Fähigkeiten seines Host-Werkzeugs.

## Kernrollen

| Rolle | Schwerpunkt | Zweck |
| --- | --- | --- |
| Atlas | Strategie & Produkt | Klären, was sich zu entwickeln lohnt. |
| Forge | Architektur & Entwicklung | Den Plan konkret machen. |
| Sentinel | Qualität & Review | Finden, was beim ersten Durchgang fehlte. |
| Nexus | Planung & Koordination | Die gemeinsame Arbeit voranbringen. |

## Pakete

| Paket | Was es bietet |
| --- | --- |
| Core | Strategie, Architektur, Entwicklung, Qualität und Koordination mit den vier Kernrollen. |
| OSINT | Recherche-Workflows zum Sammeln öffentlicher Informationen und Bewerten von Quellen. |
| Maker | Ein Workflow zum Entwerfen, Prüfen und Bereitstellen eigener BMAD+-Agenten. |
| Shield | Spezialisierte Compliance- und Governance-Workflows, unter anderem für DSGVO und ISO 27001. |
| SEO | Klassisches SEO und GEO, Sichtbarkeit in KI-generierten Antworten: technische Prüfung und Performance (Scout), Inhaltsqualität, strukturierte Daten und Bereitschaft für KI-Suche (Judge), Bewertung, Strategie und Berichte (Chief). |
| Memory | Projektnotizen, Entscheidungsprotokolle und Sitzungsübergaben für nützlichen dauerhaften Kontext. |
| Dev Studio | Spezialisierte Rollen und Workflows für Produktplanung, Design, Entwicklung und Dokumentation. |
| Backup | Anweisungen und Hilfsprogramme für datierte Sicherungen, Wiederherstellung und Rotation. |
| Animated | Ein gezielter Workflow für Websites mit videobasierten Scrolleffekten. |
| Design | Atelier, die Design-Engine: Oberflächen nach prüfbaren Regeln bauen, auditieren und überarbeiten, mit einem Briefing zuerst. |

## Beispiele

### Von einer Idee zur ersten Version

Nutze dies, nachdem du Nutzer und Problem beschrieben hast.

```text
Nexus, plane die erste nutzbare Version meiner Terminbuchungs-App. Lass Atlas den Umfang eingrenzen, Forge die kleinste Umsetzung vorschlagen und Sentinel Akzeptanzprüfungen definieren. Liste Abhängigkeiten auf und halte vor der Umsetzung zur Planprüfung an.
```

Erwartetes Ergebnis: ein priorisierter Plan, eine kleine erste Story und klare Prüfpunkte.

### Einen Fehler im bestehenden Projekt beheben

Ergänze das beobachtete Verhalten, Schritte zur Reproduktion und relevante Fehlermeldungen.

```text
Forge, untersuche, warum das Speichern einer bearbeiteten Rechnung ein Duplikat erzeugt. Reproduziere den Fehler, finde die Ursache und schlage die kleinste Korrektur vor. Ergänze eine Regressionsprüfung für den tatsächlichen Fehler und bitte Sentinel, den betroffenen Ablauf zu prüfen.
```

Erwartetes Ergebnis: ein reproduzierter Fehler, eine gezielte Korrektur und ein Nachweis der Regressionsabdeckung.

### Unabhängige Arbeit koordinieren

Nutze dies, wenn dein Host parallele Agenten unterstützt und die Aufgaben nicht dieselben Dateien bearbeiten.

```text
Nexus, teile die freigegebene Arbeit in unabhängige Aufgaben auf. Gib jeder Rolle einen Umfang, zugeordnete Dateien und klare Abschlusskriterien. Nutze parallele Agenten nur, wenn dieses Werkzeug sie unterstützt; führe die Aufgaben sonst nacheinander aus. Integriere die Ergebnisse und lass Sentinel den gesamten Nutzerablauf prüfen.
```

Erwartetes Ergebnis: begrenzte Aufträge, klare Abhängigkeiten und eine gemeinsame Abschlussprüfung. Parallele Ausführung kommt vom Host-Werkzeug.

### Eine Lieferung von einer Person bestätigen lassen

Verwenden Sie dies, wenn eine Version auf Ihrer Testumgebung ankommt und jemand sie am Bildschirm prüfen muss.

```text
Sentinel, schreibe das Abnahmerezept für diese Lieferung auf unserer Testumgebung. Ein Schritt je Handgriff, eine überprüfbare Tatsache je Zeile, Bildschirmtexte aus dem Code zitiert, und markiere die wirklich schreibenden Schritte. Baue die Seite und nenne mir Link, Dauer und was ich nicht überspringen darf. Verwende möglichst wegwerfbare Testdaten, benenne den Ordner und die Dateien, die jeder Befehl ändert, und halte automatisierte Nachweise von den Antworten der Person getrennt. Bevor du mir die Seite übergibst, baue sie mit uat build, prüfe die aufgelisteten Garantien, spiele den wesentlichen Durchgang selbst in einem echten Browser — starten, ankreuzen, eine Bemerkung tippen, neu laden, alles ist wieder da — und sage mir, welche Prüfungen liefen.
```

Erwartetes Ergebnis: eine Seite, die auch eine nicht technische Person durchgehen kann, und ein Durchlauf, den der Agent zurückliest, um jeden Fehlschlag einzuordnen, bevor etwas korrigiert wird.

### Eine Sitzung mit Zecher sichern

Nutze dies vor dem Ende einer Sitzung, wenn das optionale Memory-Pack installiert ist.

```text
Zecher, aktualisiere den Projektspeicher anhand der tatsächlich abgeschlossenen Änderungen und Prüfungen. Unterscheide implementierte, getestete, veröffentlichte und noch offene Arbeit. Halte Entscheidungen und hilfreiche Belege fest, archiviere ersetzte Notizen ohne sie zu löschen und schreibe einen kurzen Prompt für die nächste Sitzung. Halte den Speicher in diesem Projekt und lasse Geheimnisse weg.
```

Erwartetes Ergebnis: ein knapper aktueller Kontext, eine datierte Sitzungsübergabe und ein Prompt zum Fortsetzen mit der nächsten offenen Aufgabe.

### Einen Durchlauf ohne Vermutungen prüfen

Nutze dies, wenn eine Person einen Abnahmedurchlauf beendet oder unterbrochen hat.

```text
Sentinel, lies den neuesten Abnahmedurchlauf und vergleiche seinen Fingerabdruck mit dem aktuellen Rezept. Frage nach den tatsächlich ausgeführten Schritten, wenn Antworten und Nachweise widersprüchlich sind. Ordne Fehler vor Änderungsvorschlägen ein, prüfe Schreibschritte nur lesend und unterscheide menschliche Beobachtungen, automatisierte Prüfungen und ausdrücklich übernommene Risiken mit benannter verantwortlicher Person. Bestätige niemals einen nicht ausgeführten Schritt.
```

Erwartetes Ergebnis: ein klares Urteil, Nachweise für bestätigte Schreibvorgänge und eine kurze Liste noch offener Prüfungen.

### Ohne verlorene Entscheidungen fortsetzen

Nutze dies zu Beginn einer späteren Sitzung im selben Projekt; ein optionales Pack ist nicht erforderlich.

```text
Lies AGENTS.md und die verfügbare Projekterinnerung. Fasse den letzten geprüften Stand, offene Entscheidungen und die nächste unerledigte Aufgabe zusammen. Unterscheide veröffentlichte Funktionen von lokalen Kandidaten und automatisierte Prüfungen von menschlicher Abnahme. Prüfe vor dem Fortsetzen, ob die Notizen noch zum Code passen.
```

Erwartetes Ergebnis: ein kurzer, belegter Wiedereinstieg. Projektnotizen liefern Kontext und müssen mit dem aktuellen Stand abgeglichen werden.

### Einen Bildschirm mit Atelier gestalten

Nutze dies mit dem optionalen Design-Pack. Atelier stellt zuerst seine Fragen und folgt dann prüfbaren Regeln.

```text
Atelier, führe die Design-Analyse für die Rechnungsliste meiner App durch, baue den Bildschirm und schließe mit dem Preflight-Urteil ab.
```

Erwartetes Ergebnis: die festgehaltene Design-Analyse, der Bildschirm mit allen abgedeckten Zuständen und das Preflight-Urteil als letzte Zeile.

## Neu in 0.23.1

Eine ehrlichere Seite, verlässlichere Befehle

Die Dokumentationsseite ist in vier Sprachen neu aufgebaut, mit sieben Videos. Mehrere Befehle verhalten sich jetzt genau so, wie ihre Seiten es sagen: Ablehnungen lauten überall gleich, ein Review des Arbeitsbaums beginnt bei HEAD, und die Konfigurationsdatei ist schlichtes YAML. Installation und Update bleiben wie bisher.

- Die Website hat jetzt 52 Dokumentationsseiten, jede auf Englisch, Französisch, Spanisch und Deutsch, eine neu gebaute Landing-Seite und sieben Präsentationsvideos mit Untertiteln und beschriebenen Transkripten, darunter eine Fallstudie dazu, wie die Website selbst mit einem Schwarm von Agenten neu gebaut wurde.
- Ein --auto-Update, das die Richtlinie nicht erlaubt, wird überall mit derselben Meldung abgelehnt: Update refused: automatic-updates-not-authorized. Die Ablehnungen wegen eines alten Eigentumsinventars und wegen lokaler Konflikte verwenden dieselbe Form Update refused:.
- bmad-plus review scope --workspace beginnt bei HEAD, wenn du kein --base angibst; ein Review nicht eingecheckter Arbeit scheitert damit nicht mehr und zieht den letzten Commit nicht mehr mit.
- _bmad/config.yaml wird als schlichtes YAML geschrieben (auto_role_activation: true, nicht als getaggtes !!bool 'true'), egal welche unterstützte js-yaml-Version es schreibt.
- Die erzeugten Anweisungsdateien sagen, die Versionsprüfung ohne Erwähnung zu überspringen, wenn npx keine lokale Kopie von bmad-plus findet; Nexus-Fehler tragen das Präfix Nexus: einmal statt zweimal.
- Shield nennt überall PCI DSS v4.0.1, die Swarm-Skills nennen drei Arten, die Bash-Variante des Backup-Packs zeigt die Archivgröße wie die PowerShell-Variante, und npm-Beschreibung, Schlüsselwörter und README-Credits sind aktualisiert.

## Versionsverlauf

Diese Daten bezeichnen geprüfte CHANGELOG-Einträge, nicht die Veröffentlichungsdaten auf npm. Die Website prüft die npm-Veröffentlichungsdaten separat.

| Version | Datum der Notizen | Geprüfte Zusammenfassung |
| --- | --- | --- |
| 0.23.1 | 2026-10-19 | Die Dokumentationsseite ist in vier Sprachen neu aufgebaut, mit sieben Videos. Mehrere Befehle verhalten sich jetzt genau so, wie ihre Seiten es sagen: Ablehnungen lauten überall gleich, ein Review des Arbeitsbaums beginnt bei HEAD, und die Konfigurationsdatei ist schlichtes YAML. Installation und Update bleiben wie bisher. |
| 0.23.0 | 2026-10-17 | Ein Pack erklärt jetzt, welche Fragen beantwortet sein müssen, bevor es handelt, und Nexus kann einen Schwarm von Unteragenten, ein simuliertes Panel oder eine Jury innerhalb eines von dir gesetzten Budgets ausführen. Atelier, die Design-Engine, kommt als zehntes Pack hinzu. Installation und Update bleiben wie bisher. |
| 0.22.0 | 2026-09-29 | BMAD+ erklärt jetzt jede Datenübertragung und jeden Prozess, den es startet, und seine CI lehnt alles Unerklärte ab. Die Abnahmeseite und der SEO-Bericht laden nichts mehr von anderen Websites, OSINT-Aufrufe laufen nur über HTTPS, und Shield erhält einen Sicherheitsnachweis aus ausgeführten Prüfungen und ein Verzeichnis der KI-Verarbeitungen. An Installation und Update ändert sich nichts. |

[Versionsverlauf und Update-Anleitung](https://bmad-plus.rochetta.fr/de/docs/#changelog) · [Alle veröffentlichten Versionen auf npm](https://www.npmjs.com/package/bmad-plus?activeTab=versions)

---

## Lizenz

MIT — Basiert auf [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) (MIT)

BMAD+ ist ein unabhängiges Community-Projekt, abgeleitet von BMAD-METHOD (MIT) von BMad Code, LLC. Es ist weder mit BMad Code, LLC verbunden noch von BMad Code, LLC unterstützt oder zertifiziert. BMad™ und BMad Method™ sind Marken von BMad Code, LLC; siehe die [BMad-Markenrichtlinien](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/TRADEMARK.md).
Zuschreibungen und Bedingungen der enthaltenen Quellen: [Hinweise zu Drittanbietern](../THIRD-PARTY-LICENSES.md).

Das OSINT-Paket unterliegt Auflagen: Recherchen zu einer namentlich bestimmten Person erfordern einen dokumentierten Zweck und eine Rechtsgrundlage. Siehe den [rechtlichen OSINT-Hinweis](../osint-agent-package/skills/bmad-osint-investigate/osint/references/gdpr-osint.md) (auf Englisch).

### Credits

**Autor**
- **BMAD+** erstellt von [Laurent Rochetta](https://github.com/lrochetta) ([LinkedIn](https://www.linkedin.com/in/laurentrochetta/))

**Geschrieben von Laurent Rochetta**
- **Core-Erweiterungen** — Autopilot, Parallel und Sync (0.1.0), dauerhafte Nexus-Ausführung (0.15.0), Rezepte für die menschliche Abnahme (`uat`, 0.16.0), prüfbare Reviews (0.19.0) und in 0.23.0 der Paket-Intake (`bmad-plus intake`) und die Swarm-Laufzeit (`bmad-plus swarm`) samt den Registry-Feldern und dem Trigger-Gate, die sie speisen
- **Dev Studio** — 6 spezialisierte SDLC-Agenten: Miriam (Business-Analystin), Huldah (Technische Redakteurin), Yosef (Produktmanager), Rachel (UX-Designerin), Bezalel (Systemarchitekt), Oholiab (Senior Engineer) — 38 Workflows, geschrieben als eigenständige BMAD+-Anweisungen; die Persona-Namen und die Herkunft der Workflows erkennen BMAD-METHOD 6.6.0 (MIT) an. Das Paket-Register ist `src/bmad-plus/packs/pack-dev-studio/upstream-sync.yaml`
- **Maker** — eigene BMAD+-Agenten entwerfen, bauen, validieren und paketieren (2026-03-17)
- **Design** — Atelier, aufgebaut auf dem eigenen öffentlichen npm-Paket des Autors [design-skill](https://github.com/lrochetta/design-skill) (MIT): Das Paket liefert die drei Skills und ihre Regeln, BMAD+ ergänzt Persona, Intake und Routing
- **Memory** — Zecher-Agent für ein sitzungsübergreifendes Gedächtnis, mit Projektscanner und Brain-Erkennung; die darin enthaltenen Karpathy-Guardrails sind adaptiert, siehe unten
- **SEO** — 3 Agenten (Scout, Chief, Judge), 6-phasige Audit-Pipeline, PageSpeed-Optimierungsschleife, Integrationen für Google Search Console und GA4; Version 2.0 baute den ersten, bei Oveanet geschriebenen SEO-Audit-Agenten neu auf und behielt dessen PageSpeed-Playbook
- **Backup** und **Animated** — zeitgestempelte Projekt-Backups und videogesteuerte Scroll-Websites; bei Oveanet, dem Unternehmen von Laurent Rochetta, geschrieben und in 0.2.0 (2026-03-18) zusammen mit dem ersten SEO-Agenten in BMAD+ aufgenommen

**Abgeleitet von BMAD-METHOD** (MIT)
- **BMAD-METHOD** von [bmad-code-org](https://github.com/bmad-code-org/BMAD-METHOD) — ursprüngliche Multi-Agenten-Methodik (MIT); BMAD+ ist eine unabhängige Ableitung, kein offizielles Release
- **Core** — Atlas, Forge, Sentinel und Nexus: BMAD+ begann als Fork von BMAD-METHOD 6.2.0 und wurde von Laurent Rochetta erweitert (siehe Core-Erweiterungen oben). Die vier Personas folgen dem Persona-Format und übernehmen teilweise die Formulierungen der Personas Analyst (Atlas), Architekt (Forge), QA (Sentinel) und Scrum Master (Nexus); das Zusammenführen von Rollen zu einer umschaltbaren Persona und die automatische Aktivierung sind Ergänzungen von BMAD+

**Adaptiert aus anderen Open-Source-Projekten**
- **Shield** — 27 Compliance-Agenten und 11 Workflows, adaptiert von [Hemant Naiks GRC-Skills](https://github.com/Sushegaad/Claude-Skills-Governance-Risk-and-Compliance) (MIT), mit deren 79 Referenzdateien; die DSGVO- und AI-Act-Workflows orientieren sich zusätzlich an der Architektur des Skills-Katalogs von [Lawve.ai](https://lawve.ai) (Oliver Schmidt-Prietz). Orchestrator, Cross-Framework-Mapping, Berichtsvorlagen, Assurance Case, KI-Verarbeitungsregister und Compliance-Review-Regeln sind Ergänzungen von BMAD+
- **OSINT** — Pipeline und Python-Helfer adaptiert von [smixs/osint-skill](https://github.com/smixs/osint-skill) (MIT); das Rechtsgrundlagen-Gate und der rechtliche Hinweis sind Ergänzungen von BMAD+
- **Apify-Integration** — OSINT-Helfer, inspiriert von den [Apify Agent Skills](https://github.com/apify/agent-skills) (Upstream deklariert Apache-2.0; siehe Hinweise)
- **Karpathy Guardrails** — Memory-Adaption der [Community-Richtlinien von forrestchang](https://github.com/multica-ai/andrej-karpathy-skills), inspiriert von Andrej Karpathy (Upstream deklariert MIT)
