# Mijnbouwschadecheck

Zelf te hosten Nederlandstalige React/TypeScript-website, Express-backend en PostgreSQL- of MariaDB-database. **Geen Supabase-account of externe authdienst nodig.** De gratis check verzamelt aanvragen voor eigen persoonlijke opvolging. Er is geen marketing- of distributiesysteem.

## Starten op je eigen machine

Benodigd: Node.js 24, npm, PostgreSQL 17. Docker is optioneel en levert in `compose.yaml` een lokale database en Mailpit-testmailserver.

1. `npm ci` (in deze cloudomgeving eventueel `--cache /tmp/mijnbouw-npm-cache`).
2. Kopieer `.env.example` naar `.env`, zonder een bestaande `.env` te overschrijven.
3. Stel `DATABASE_URL` in voor je PostgreSQL-database. Voor de lokale Compose-database: stel daarnaast `POSTGRES_PASSWORD` in de shell in op hetzelfde zelfgekozen wachtwoord en voer `docker compose up -d --wait` uit. Gebruik geen voorbeeldwachtwoord voor productie. PostgreSQL is alleen op loopback bereikbaar; data staat in de genegeerde `.local/postgres`.
4. `npm run db:migrate`. Dit voert migraties en de initiële vragenlijst transactioneel uit. Herhalen is veilig; de actieve vragenlijst wordt niet overschreven.
5. Stel tijdelijk `ADMIN_EMAIL` en `ADMIN_PASSWORD` veilig in de procesomgeving in, voer `npm run admin:create` uit en verwijder het wachtwoord daarna uit de omgeving. Minimum: 12 tekens. Er is precies één beheerder; publieke registratie bestaat niet.
6. `npm run build && npm start`. Website en API draaien op poort 3001. Stel `SITE_URL=http://localhost:3001` in voor deze lokale start. Voor hot reload: `SITE_URL=http://localhost:5173 npm run dev`.

De cloudomgeving heeft alleen een fictief lokaal testaccount (`admin@example.invalid`, wachtwoord `test-only-password-123`). Dit wordt niet automatisch door migraties aangemaakt en mag niet naar productie worden meegenomen. Bij installatie op je eigen server maak je zelf een beheerder aan.

Zonder databaseconfiguratie toont de site de eerste vragenlijst als demonstratie en weigert aanvragen op te slaan. Er wordt dan geen resultaat of nep-success getoond.

## Configuratie

| Variabele                                                      | Gebruik                                                                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                 | PostgreSQL-verbinding, uitsluitend serverzijdig                                                                               |
| `DATABASE_SSL`                                                 | `true` voor een PostgreSQL-verbinding met geverifieerde TLS; vertrouw de systeem-CA of configureer de CA via je platform      |
| `SITE_URL`                                                     | Exacte browser-origin, inclusief schema en eventuele poort; nodig voor CSRF-controle en beheer/herstellinks                   |
| `PORT`                                                         | HTTP-poort, standaard 3001                                                                                                    |
| `NODE_ENV`                                                     | `production` activeert Secure-cookies en strikte productievereisten                                                           |
| `TRUST_PROXY`                                                  | Alleen `1` als exact één vertrouwde reverse proxy voor de applicatie staat en de applicatiepoort niet publiek toegankelijk is |
| `COMPANY_NAME`, `COMPANY_DETAILS`                              | Eigen bedrijfsnaam en gecontroleerde bedrijfsgegevens; geen verzonnen KvK of adres                                            |
| `CONTACT_EMAIL`, `CONTACT_PHONE`                               | Publieke contactgegevens                                                                                                      |
| `PRIVACY_CONTACT`, `PRIVACY_LEGAL_BASIS`, `PRIVACY_PROCESSORS` | Door de eigenaar vastgestelde privacy-informatie en verwerkers/doorgiftegegevens                                              |
| `PRIVACY_APPROVED`                                             | Alleen `true` na beoordeling door de eigenaar; productieaanvragen blijven anders geblokkeerd                                  |
| `RETENTION_DAYS`                                               | Door de eigenaar vastgestelde positieve bewaartermijn; geen verzonnen standaard                                               |
| `SMTP_HOST`, `SMTP_PORT`                                       | Eigen SMTP-dienst (standaardpoort 587)                                                                                        |
| `SMTP_SECURE`                                                  | `true` voor impliciete TLS, bijvoorbeeld poort 465                                                                            |
| `SMTP_REQUIRE_TLS`                                             | Standaard `true`; alleen voor lokale Mailpit `false`                                                                          |
| `SMTP_USER`, `SMTP_PASSWORD`                                   | Eventuele SMTP-authenticatie, uitsluitend serverzijdig                                                                        |
| `EMAIL_FROM`, `NOTIFICATION_EMAIL`                             | Geldige afzender en eigen notificatieadres                                                                                    |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                | Alleen tijdelijk voor `admin:create`                                                                                          |
| `ADMIN_TOTP_SECRET`                                            | Optioneel base32 TOTP-secret bij het aanmaken van de beheerder                                                                |

Voor lokale testmail: `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `SMTP_REQUIRE_TLS=false`, fictieve `EMAIL_FROM` en `NOTIFICATION_EMAIL`. Mailpit vangt e-mails op en verstuurt ze niet naar echte ontvangers. De huidige cloudtest gebruikt deze configuratie. Een externe SMTP-dienst is nog niet aangesloten.

## Hosting bij mijn.host

Voor Node.js 24 met MariaDB in DirectAdmin: zie [de stapsgewijze installatiehandleiding](docs/mijnhost.md). Het startupbestand is `app.cjs`. Gebruik voor MariaDB een `mysql://`- of `mariadb://`-DATABASE_URL. Bestaande PostgreSQL-installaties blijven ondersteund; gegevens worden niet automatisch tussen databases overgezet.

## Zelf hosten

### Zoekmachines

Voor de openbare website is de officiële origin `https://www.mijnbouwschadecheck.nl`. Stel bij livegang `SITE_URL=https://www.mijnbouwschadecheck.nl` in. Houd voor lokaal testen `SITE_URL=http://localhost:3001`; lokale HTTP-versies worden niet geïndexeerd. De Node-server levert per pagina titels, beschrijvingen, canonical-URL's en Open Graph-metadata, plus WebSite-structured data op de homepage. `/sitemap.xml` gebruikt de ingestelde openbare HTTPS-origin. De beheeromgeving heeft noindex en onbekende pagina's geven HTTP 404. Robots-instructies vervangen geen toegangsbeveiliging.

Host de website via de Node-server (`npm start`), zodat deze metadata en endpoints beschikbaar zijn. Richt redirects van HTTP en eventuele andere domeinvarianten naar de officiële HTTPS/www-origin in bij de reverse proxy. Meld na livegang de sitemap aan in Google Search Console en controleer de gerenderde pagina met URL-inspectie: de pagina-inhoud wordt door React geladen en vereist JavaScript. De build en lokale tests bewijzen geen indexering of zoekpositie.

De applicatie is één Node-proces dat de productiebuild en API serveert. `Dockerfile` maakt een runtime-image met Node 24; gebruik `docker build -t mijnbouwschadecheck .`. Voer migraties met dezelfde image en configuratie uit (`npm run db:migrate`) vóór de applicatiestart. Maak de beheerder apart aan met tijdelijk geïnjecteerde secrets. Je kunt ook zonder Docker `npm ci`, `npm run build` en `npm start` gebruiken.

Plaats een reverse proxy zoals Caddy of nginx vóór de applicatie met HTTPS. Stel `SITE_URL` in op je werkelijke HTTPS-origin en `NODE_ENV=production`. Publiceer alleen de proxy, houd PostgreSQL op een privénetwerk en gebruik sterke afzonderlijke databasecredentials. De browser bevat geen databasewachtwoord of serverkey en kent geen directe databaseverbinding. Alle beheermutaties gaan via geauthenticeerde server-endpoints. PostgreSQL tabellen en functies geven geen toegang aan de `PUBLIC`-rol. Gebruik een afzonderlijke databaserol voor de applicatie en geef alleen deze rol toegang tot de benodigde tabellen, sequences en functies na migratie door de eigenaar. Geef die rol geen superuser-, rolbeheer- of database-aanmaakrechten. De initiële lokale Docker-rol is uitsluitend bedoeld voor ontwikkeling.

Productiestart vereist een database, HTTPS-site-URL en SMTP/notificatieconfiguratie. Aanvragen blijven gesloten totdat privacygoedkeuring, bedrijfsgegevens, privacycontact, juridische grondslag, verwerkersgegevens en bewaartermijn zijn ingevuld. Zorg vóór livegang voor databaseback-ups, getest herstel, verwerkersafspraken, netwerk/firewallconfiguratie en bewaking van de applicatie en outbox. Configureer proxylogs zonder bodies, querystrings, cookies of persoonsgegevens.

`npm run retention` verwijdert aanvragen ouder dan `RETENTION_DAYS`, met antwoorden, notities, auditregels en outbox via cascades. De job weigert te draaien zonder positieve termijn en privacygoedkeuring. Er is bewust geen standaard cronjob actief; plan hem pas nadat de termijn is vastgesteld. Bestaande back-ups hebben een afzonderlijk te bepalen retentiebeleid.

## Authenticatie en persoonlijke controle

De beheeromgeving is bereikbaar via `/admin_sander`, lokaal bijvoorbeeld `http://localhost:3001/admin_sander`. Er staat geen beheerlink in de publieke navigatie. De oude route `/beheer` geeft 404. Inloggen blijft verplicht; de aangepaste URL vervangt geen toegangsbeveiliging. Herstel- en notificatiemails verwijzen naar de nieuwe beheerroute.

Wachtwoorden zijn gesalt met scrypt. Sessies zijn willekeurige 256-bit tokens; alleen hashes staan in PostgreSQL. HttpOnly/SameSite=Strict-cookies, Secure in productie, sessies maximaal 8 uur. Herstel gebruikt eenmalige gehashte tokens van 30 minuten, verstuurd via SMTP; tokens staan in de URL-fragmentidentifier en worden meteen uit de browseradresbalk verwijderd. Herstel trekt alle bestaande sessies in.

Optionele MFA: genereer een veilig base32-secret buiten de repository, configureer het in je authenticator als TOTP met SHA-1, 6 cijfers en 30 seconden en injecteer datzelfde secret tijdelijk als `ADMIN_TOTP_SECRET` tijdens `admin:create`. MFA wordt serverzijdig bij login en wachtwoordherstel afgedwongen zodra een secret is ingesteld. Bewaar een veilige herstelkopie buiten de applicatie. Er is geen publieke MFA-registratie of recovery-code-UI. Een beheerder zonder MFA heeft alleen een wachtwoord; gebruik MFA voor productie.

Leadstatus en persoonlijke controle zijn aparte velden. Alleen na **opgeslagen** persoonlijke controle verschijnen telefoon/e-mailacties. Dit is een workflowbeperking: contactgegevens blijven voor de beheerder zichtbaar en zijn geen technisch verbod op handmatig contact.

## Vragenlijst en voorgestelde bedrijfsregel

De eerste versie staat in `src/domain.ts` en volgt de meegeleverde bouwopdracht. Het oorspronkelijke Word-document is niet aangeleverd; verificatie tegen dat bronbestand blijft aan de eigenaar.

Stabiele vraag- en optie-ID’s zijn de sleutels, labels zijn uitsluitend presentatietekst. De vijf gemarkeerde opties zijn positieve signalen. Voorgestelde V1-regel: één of meer signalen → `possible`, anders `review_needed`. Geen definitieve negatieve uitslag of recht op vergoeding. De signalen zijn instelbaar in beheer; alleen deze expliciete regel wordt ondersteund.

Vragen en opties kunnen in een concept worden toegevoegd, gewijzigd, verwijderd en geordend; velden ondersteunen tekst, één of meer keuzes, verplichtheid en eenvoudige zichtbaarheid. De noodzakelijke basisvragen en schade-afhankelijkheid blijven beschermd. Verwijzingen en cycli worden vóór publicatie afgewezen. Concept opslaan → preview → publiceren. Publicatie is transactioneel; oude versies worden gearchiveerd en blijven bruikbaar voor lopende sessies. Een ingediende aanvraag heeft een snapshot van vragen, antwoordlabels, regels en redenen. Conceptverwijdering raakt historische antwoorden niet. Er is geen generieke Word-import.

## Opslag en notificaties

De publieke API valideert vraag-ID’s, opties, types en vereiste velden, normaliseert postcode, telefoon en e-mail en berekent de indicatie serverzijdig. Vervalsing van indicatie of willekeurige extra metadata wordt afgewezen. Ook `review_needed` wordt opgeslagen.

Aanvraag + snapshots + outbox-item worden in één databasefunctie transactioneel geschreven. Een unieke UUID-idempotency-key en payloadhash voorkomen dubbele opslag; dezelfde sleutel met een andere inhoud geeft 409. Bij een netwerkfout kan dezelfde aanvraag opnieuw worden verzonden. Verschillende sleutels worden nooit op basis van adres/e-mail samengevoegd.

De outbox-worker claimt met locks, verstuurt alleen aanvraagnummer en beveiligde beheerlink, herhaalt met vertraging en stopt na vijf pogingen. Een mailfout verwijdert geen aanvraag. Afleverstatus staat in het detail. SMTP is at-least-once: een procescrash na SMTP-acceptatie maar vóór de database-update kan een dubbele notificatie geven; de aanvraag zelf wordt niet gedupliceerd. Definitief mislukte items blijven zichtbaar en kunnen door de serverbeheerder na diagnose terug op `pending`, `attempts=0`, `next_attempt_at=now()` worden gezet. `delivered` betekent acceptatie door SMTP, geen bewijs dat iemand de melding heeft gelezen.

Publieke beveiliging: payloadlimiet 32 KiB, honeypot, IP-rate-limit, strikte JSON, Origin-controle, Helmet-headers, React-escaping en geen logs van payloads/secrets. Captcha en automatische adresaanvulling zijn niet aangesloten; straat en woonplaats zijn handmatig invulbaar. Voor meerdere applicatiereplica’s moet de IP-limiter worden vervangen door een gedeelde store; deze versie is bedoeld voor één serverproces.

## Tests en controle

- `npm test`: domeinregels, alle vijf signalen, negatieve/incomplete payloads, conditionele velden, authcrypto, databasefuncties op een geïsoleerde PostgreSQL-engine (PGlite), idempotentie, publicatie, historie, controlevelden en verwijdercascades.
- `npm run build`: TypeScript en productiebuild.
- `npm run test:e2e`: Chromium desktop/mobiel, volledige aanvraag op een echte PostgreSQL-backend, beheertoegang, opgeslagen controle vóór contactacties, CSRF, validatie, toetsenbord en WCAG-scan. Start eerst de applicatie en een afzonderlijke lokale testdatabase; gebruik uitsluitend fictieve gegevens. Configureer `E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` indien afwijkend. Tests maken aanvragen aan en wijzigen hun status; **draai niet tegen productie**.
- Browser installeren indien nodig: `npx playwright install chromium`. Deze cloud heeft `/usr/bin/chromium`; gebruik hier `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`.

Lokale validatie bewijst niet dat externe hosting, DNS, HTTPS-certificaten of een echte SMTP-dienst zijn aangesloten. Er is niets naar een publiek domein gepubliceerd.

## Cloudtaken hervatten

Elke cloudtaak heeft al een geïsoleerde checkout; maak geen Git-worktree. `npm run cloud:services` controleert de bestaande lokale database en testmailserver en start bij ontbreken de ontwikkelservices met Compose. Het helperprogramma werkt uitsluitend voor de beschreven lokale ontwikkelconfiguratie en is uitgeschakeld in productie. Erna: `npm run db:migrate` en `npm start`. Processen en Docker-containers hoeven een cloudsnapshot niet te overleven; Compose-data staat onder `.local`, en migraties initialiseren een lege database veilig. Een nieuwe lege database heeft geen beheerder: maak die expliciet aan zoals hierboven beschreven. Een gepubliceerde cloudsnapshot is nog niet op een nieuwe machine getest.

De cloud heeft beperkt netwerkverkeer vanuit Docker-builds. De runtime-image is afzonderlijk gecontroleerd met dezelfde lockfile en een vooraf geverifieerde npm-cache in een tijdelijke buildcontext; de normale online Docker-build is hier beperkt door netwerktoegang. De Dockerfile ondersteunt optioneel een vertrouwde extra CA als BuildKit-secret `npm_ca`; TLS- en integriteitsverificatie blijven ingeschakeld.
