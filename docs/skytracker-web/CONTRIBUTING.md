# Contributing to SkyTracker Web

Iedere toekomstige Codex-sprint volgt deze volgorde:

1. Lees volledig `MASTER_PROMPT.md`.
2. Lees daarna `ROADMAP.md`.
3. Lees vervolgens het betreffende bestand onder `sprints/`.
4. Controleer de actuele worktree en relevante implementatie.
5. Werk uitsluitend binnen de sprintscope en het Minimal Change Principle.
6. Voer alleen de voor die sprint vereiste verificatie uit.
7. Rapporteer gewijzigde bestanden, tests/builds, acceptatie en open punten.

Een sprint wijzigt geen architectuur, design, dependency, backendcontract,
provider, monetization of AI zonder expliciete opdracht. Bestaande sprintdocs
blijven historisch bewijs; de centrale documenten zijn leidend bij conflict.

## Browseracceptatie

Voor iedere browseracceptatie:

1. voer `.\scripts\skytracker-dev-status.ps1` uit;
2. voer indien nodig `.\scripts\skytracker-dev-start.ps1` uit;
3. start geen handmatige nieuwe servers wanneer bestaande services gezond zijn;
4. laat services na acceptatie standaard draaien voor Product Owner-controle;
5. gebruik uitsluitend `.\scripts\skytracker-dev-stop.ps1` wanneer opruimen
   expliciet nodig is.
