# Installeren bij mijn.host (Node.js + MariaDB)

Deze versie ondersteunt MariaDB 11.8 en behoudt PostgreSQL voor bestaande lokale installaties. Een lege MariaDB-database wordt met `npm run db:migrate` geïnitialiseerd. Dit kopieert **geen** bestaande PostgreSQL-data of beheeraccounts; stel op de nieuwe server zelf een beheerder in. Bewaar de oude lokale installatie en database als je die nog nodig hebt. Er is geen automatische omzetting van historische aanvragen.

## 1. Applicatie en bestanden

Selecteer mijnbouwschadecheck.nl in het hostingpaneel. Maak in Node.js een applicatie met:

- Node.js 24 (bijvoorbeeld 24.20.0).
- Application mode: Production.
- Application root: mijnbouwschadecheck (buiten public_html).
- Application URL: mijnbouwschadecheck.nl, extra pad leeg.
- Application startup file: **app.cjs**.

Upload de inhoud van het project naar de application root. `package.json`, `package-lock.json`, `app.cjs`, `server`, `src`, `database`, `index.html`, `vite.config.ts` en `tsconfig.json` moeten daar staan. Upload geen lokale `.env`, `node_modules`, `.local`, Git-map of testdatabase. Stel de applicatie pas beschikbaar nadat dependencies, build en productieconfiguratie klaar zijn. Gebruik de door het paneel getoonde SSH-activatieopdracht voor de Node.js-omgeving; het exacte pad is accountspecifiek.

## 2. Database en configuratie

Maak in DirectAdmin een nieuwe MariaDB-database met eigen gebruiker en sterk wachtwoord. Gebruik de volledige namen inclusief accountprefix. De gebruiker heeft CREATE/ALTER/INDEX en SELECT/INSERT/UPDATE/DELETE nodig voor de migratie en werking binnen **de eigen database**, geen globale SUPER-, CREATE ROUTINE- of serverbeheerrechten. Na installatie kunnen DDL-rechten worden beperkt waar het hostingpaneel dat toestaat.

Voeg onderstaande instellingen toe als omgevingsvariabelen in het paneel, of als beschermd `.env`-bestand in de application root. Voorkom dubbele, tegenstrijdige instellingen: procesvariabelen hebben voorrang boven `.env`. Zet nooit secrets in Git of public_html.

```dotenv
DATABASE_URL=mysql://VOLLEDIGE_GEBRUIKER:URL_ENCODED_WACHTWOORD@localhost:3306/VOLLEDIGE_DATABASE
DATABASE_SSL=false
NODE_ENV=production
SITE_URL=https://www.mijnbouwschadecheck.nl
SMTP_HOST=SMTP_SERVER_VAN_MIJN_HOST
SMTP_PORT=465
SMTP_SECURE=true
SMTP_REQUIRE_TLS=true
SMTP_USER=VOLLEDIG_MAILADRES
SMTP_PASSWORD=MAILBOXWACHTWOORD
EMAIL_FROM=VOLLEDIG_MAILADRES
NOTIFICATION_EMAIL=BEHEERDERSMAILADRES
```

Gebruik de exacte databasehost en SMTP-instellingen van mijn.host. Voor een externe databaseverbinding: `DATABASE_SSL=true` met geverifieerde TLS; gebruik false alleen voor de lokale databaseverbinding als mijn.host dat voorschrijft. Speciale tekens in het databasewachtwoord moeten URL-encoded zijn (bijvoorbeeld `@` → `%40`, `#` → `%23`, `%` → `%25`). Encodeer uitsluitend het wachtwoordgedeelte, niet de hele URL. SMTP-wachtwoorden zijn gewone tekstwaarden, geen URL-encoding. Kies bij SMTP-poort 587 `SMTP_SECURE=false` en behoud `SMTP_REQUIRE_TLS=true`.

`PORT` wordt door de hosting beheerd: stel niet blind een eigen poort in. Het startupbestand respecteert `PORT`. Passenger kan in plaats daarvan de listener overnemen. Stel `TRUST_PROXY=1` alleen in als mijn.host bevestigt dat exact één vertrouwde reverse proxy voor de app staat en direct verkeer naar de app wordt geblokkeerd. Test de juiste client-IP en Secure-cookies achter de echte hostingproxy.

Stel voor het openen van aanvragen ook de echte bedrijfs- en privacygegevens in: `COMPANY_NAME`, `COMPANY_DETAILS`, `CONTACT_EMAIL`, `CONTACT_PHONE`, `PRIVACY_CONTACT`, `PRIVACY_LEGAL_BASIS`, `PRIVACY_PROCESSORS`, `RETENTION_DAYS`. Zet `PRIVACY_APPROVED=true` pas na beoordeling door de eigenaar. Zonder deze gegevens weigert productie aanvragen op te slaan. Kies zelf een bewaartermijn; er is geen verzonnen standaard.

## 3. Installeren via SSH

Activeer de Node.js-omgeving met de exacte opdracht die het hostingpaneel toont. Ga naar de application root en controleer `node --version` (24.x). Voer uit:

```sh
npm ci --include=dev
npm run build
npm run db:migrate
```

Migraties mogen opnieuw worden uitgevoerd. MariaDB voert DDL niet transactioneel uit; onderbroken schema-aanmaak kan opnieuw worden gestart. Een databasegebonden lock serialiseert migraties. De actieve vragenlijst wordt niet overschreven. De PostgreSQL-migraties worden alleen voor een PostgreSQL-URL gebruikt.

Maak één beheerder aan via tijdelijk ingestelde `ADMIN_EMAIL` en `ADMIN_PASSWORD` in een **beveiligde** procesomgeving. Het wachtwoord moet minimaal 12 tekens bevatten. Gebruik geen cloudtestaccount. Als deze waarden via het Node.js-paneel zijn ingesteld, betekent dat niet dat SSH ze ook ontvangt: stel ze veilig in de beheeropdrachtomgeving in of gebruik tijdelijk een beschermd configuratiebestand. Voer uit:

```sh
npm run admin:create
```

Verwijder daarna de tijdelijke ADMIN-waarden en herstart de applicatie. Gebruik voor normaal bedrijf geen opgeslagen beheerwachtwoord in de configuratie.

De runtime gebruikt `tsx` uit de reguliere dependencies; de build vereist devDependencies. Het is niet nodig om TypeScript naar een apart serverbestand te compileren. `app.cjs` registreert de runtime en start vanuit de juiste werkmap.

## 4. Domein, starten en controleren

Zorg dat zowel de www- als de kale domeinvariant op de app uitkomen en een geldig HTTPS-certificaat hebben. Laat HTTP en de kale domeinvariant door de hosting redirecten naar **https://www.mijnbouwschadecheck.nl**. De app verwacht voor mutaties exact die origin. Start/herstart de applicatie via het paneel met `app.cjs` als startupbestand.

Controleer:

- `/api/health`: `server: "ok"` en `databaseConfigured: true`.
- Homepage: vragenlijst laadt; voer een herkenbare fictieve testaanvraag in en verwijder die na controle.
- `/admin_sander`: eigen beheeraccount werkt, aanvragen zijn afgeschermd zonder login.
- Wachtwoord vergeten: echte e-mail arriveert, link wijst naar het HTTPS/www-domein, nieuw wachtwoord werkt en de link kan niet opnieuw gebruikt worden.
- Notificatie komt aan; een SMTP-fout verwijdert geen aanvraag.
- `/robots.txt`, `/sitemap.xml` en canonical-URL gebruiken de juiste origin.

De tests op een lokale MariaDB-server bewijzen niet dat het hostingpaneel, SMTP, DNS of Passenger al correct zijn ingesteld. Bekijk applicatielogs bij fouten; publiceer geen `.env`, cookies, resetlinks of persoonsgegevens in supportberichten.

## 5. Notificaties en onderhoud

De actieve app verwerkt elke 30 seconden een outbox-batch. Gedeelde hosting kan processen pauzeren als er geen verkeer is. Plan daarom via het hostingpaneel elke minuut een cronjob in die met de juiste Node.js-omgeving en werkmap `npm run outbox:run` uitvoert. Die job heeft dezelfde database- en SMTP-instellingen nodig. Gebruik het accountspecifieke Node-pad uit het paneel en dezelfde veilige configuratie. Vergrendelingen voorkomen dat gelijktijdige jobs hetzelfde item claimen. SMTP is at-least-once: na een crash kan een notificatie dubbel aankomen.

Stel databaseback-ups in en test herstel. Plan `npm run retention` pas nadat de bewaartermijn en privacy-instellingen zijn vastgesteld. Er wordt geen automatische verwijderjob ingeschakeld.

## MariaDB-integratietests (alleen ontwikkeling)

`npm test` controleert PostgreSQL via PGlite. De MariaDB-suite wordt alleen uitgevoerd als `MARIADB_TEST_URL` is ingesteld op een **aparte wegwerpdatabase waarvan de naam eindigt op `_test`**. Deze suite verwijdert testdata. Gebruik nooit je hostingdatabase. Voorbeeld met een eigen lokale testdatabase: `MARIADB_TEST_URL=mysql://.../mijnbouw_test npm test`. De bestaande Playwright-suite kan met `E2E_BASE_URL` tegen een lokale MariaDB-app draaien. Gebruik uitsluitend fictieve gegevens.
