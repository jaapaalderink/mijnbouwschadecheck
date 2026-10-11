import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  initial,
  visible,
  cleanAnswers,
  answerErrors,
  contactSchema,
  resultText,
  validateQuestionnaire,
  type Questionnaire,
  type Answers,
  type Question,
} from "./domain";
import "./style.css";
type Config = {
  configured: boolean;
  company: string;
  email: string;
  phone: string;
  privacyContact: string;
  retention: string;
  privacyApproved: boolean;
  companyDetails: string;
  legalBasis: string;
  processors: string;
};
const defaultConfig: Config = {
  configured: false,
  company: "Mijnbouwschadecheck",
  email: "",
  phone: "",
  privacyContact: "",
  retention: "",
  privacyApproved: false,
  companyDetails: "",
  legalBasis: "",
  processors: "",
};
async function request(
  path: string,
  options: RequestInit = {},
  token?: string,
) {
  const r = await fetch("/api" + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(Error(data.error ?? "De actie is niet gelukt."), {
      fields: data.fields,
    });
  return data;
}
function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    request("/config")
      .then(setConfig)
      .catch(() => {});
    const handler = () => setPath(location.pathname);
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
  function navigate(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const next = new URL(event.currentTarget.href).pathname;
    history.pushState(null, "", next);
    setPath(next);
    window.scrollTo(0, 0);
  }
  return (
    <>
      <a className="skip" href="#main">
        Direct naar inhoud
      </a>
      <header>
        <a className="brand" href="/" onClick={navigate}>
          <span className="brand-symbol" aria-hidden="true">
            m.
          </span>
          <span>
            mijnbouw<span className="brand-light">schadecheck</span>
            <small>Onafhankelijk advies</small>
          </span>
        </a>
        <nav aria-label="Hoofdnavigatie">
          <a href="/" onClick={navigate}>
            De gratis check
          </a>
          <a href="/contact" onClick={navigate}>
            Contact
          </a>
          <a className="nav-button" href="/beheer" onClick={navigate}>
            Beheer ↗
          </a>
        </nav>
      </header>
      <main id="main">
        {path === "/beheer" ? (
          <Admin config={config} />
        ) : path === "/privacy" ? (
          <Privacy config={config} />
        ) : path === "/contact" ? (
          <section className="page">
            <span className="eyebrow">WE HELPEN JE VERDER</span>
            <h1>Persoonlijk contact.</h1>
            <p>
              Heb je een vraag over de check of een aanvraag? Neem contact op
              met {config.company}.
            </p>
            {config.email ? (
              <p>
                <a href={"mailto:" + config.email}>{config.email}</a>
              </p>
            ) : (
              <p className="notice">
                Het contactadres moet nog door de eigenaar worden ingevuld.
              </p>
            )}
            {config.phone && (
              <p>
                <a href={"tel:" + config.phone}>{config.phone}</a>
              </p>
            )}
            <p>
              Onafhankelijk adviesbureau. Geen onderdeel van IMG of overheid.
              Eventuele kosten voor een vervolgtraject worden vooraf besproken.
            </p>
          </section>
        ) : (
          <Home config={config} />
        )}
      </main>
      <footer>
        <div>
          <strong>{config.company}</strong>
          <p>
            Voor Groningen.
            <br />
            Onafhankelijk. Persoonlijk. Duidelijk.
          </p>
        </div>
        <div>
          <a href="/privacy" onClick={navigate}>
            Privacy
          </a>
          <a href="/contact" onClick={navigate}>
            Contact
          </a>
          <p>Geen onderdeel van IMG of overheid.</p>
        </div>
      </footer>
    </>
  );
}
function Home({ config }: { config: Config }) {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="dot" /> GRONINGEN
          </span>
          <h1>
            Schade aan je woning?
            <br />
            <em>Begin met duidelijkheid.</em>
          </h1>
          <p className="lead">
            Scheuren in de muur kunnen vragen oproepen. Met onze gratis check
            zet je de eerste stap naar persoonlijk advies over fysieke
            mijnbouwschade in Groningen.
          </p>
          <div className="promises">
            <span>✓ Gratis en vrijblijvend</span>
            <span>✓ Persoonlijk gecontroleerd</span>
          </div>
          <div className="house-art" aria-hidden="true">
            <svg viewBox="0 0 450 250" fill="none">
              <path d="M30 220H430" stroke="#bbcac0" />
              <path
                d="M100 215V100L215 25L330 100V215"
                fill="#e5ebe3"
                stroke="#788e7b"
                strokeWidth="2"
              />
              <path
                d="M78 113L215 23L352 113"
                stroke="#244e3b"
                strokeWidth="5"
              />
              <path d="M270 60V30H295V78" stroke="#244e3b" strokeWidth="3" />
              <path d="M191 215V147H240V215" fill="#244e3b" />
              <path
                d="M125 125H167V165H125ZM267 125H309V165H267Z"
                fill="#fafaf2"
                stroke="#788e7b"
                strokeWidth="2"
              />
              <path
                d="M146 125V165M125 145H167M288 125V165M267 145H309"
                stroke="#788e7b"
              />
              <path
                d="M176 96L185 108L177 122L185 132"
                stroke="#b58c58"
                strokeWidth="2"
              />
              <circle cx="378" cy="158" r="29" fill="#c9d4bf" />
              <path d="M378 175V218" stroke="#788e7b" strokeWidth="3" />
              <circle cx="60" cy="184" r="19" fill="#c9d4bf" />
              <path d="M60 194V218" stroke="#788e7b" strokeWidth="3" />
            </svg>
            <span>Een eerste stap. Geen officiële beoordeling.</span>
          </div>
        </div>
        <QuestionnaireForm config={config} />
      </section>
      <section className="process">
        <span className="eyebrow">ZO WERKT HET</span>
        <h2>Van een vraag naar persoonlijk advies.</h2>
        <div className="process-grid">
          <article>
            <span className="number">01</span>
            <h3>Vertel over je woning</h3>
            <p>
              Beantwoord een paar vragen over je woning en eventuele zichtbare
              schade.
            </p>
          </article>
          <article>
            <span className="number">02</span>
            <h3>Ontvang een eerste indicatie</h3>
            <p>
              Na ontvangst van je aanvraag krijg je een voorlopige indicatie.
              Dit is geen garantie op vergoeding.
            </p>
          </article>
          <article>
            <span className="number">03</span>
            <h3>We nemen contact met je op</h3>
            <p>
              Iedere aanvraag wordt persoonlijk gecontroleerd voordat we contact
              opnemen. Vervolgkosten bespreken we vooraf.
            </p>
          </article>
        </div>
      </section>
      <section className="reassurance">
        <div>
          <span className="eyebrow">HELDER VANAF HET BEGIN</span>
          <h2>Jouw aanvraag blijft bij ons.</h2>
        </div>
        <p>
          We gebruiken je gegevens voor onze eigen opvolging. We verkopen of
          verspreiden geen aanvragen. Deze check gaat over woningkenmerken en
          fysieke schade; hij beoordeelt geen waardedaling of immateriële
          schade.
        </p>
      </section>
    </>
  );
}
function QuestionField({
  q,
  value,
  error,
  onChange,
}: {
  q: Question;
  value: string | string[] | undefined;
  error?: string;
  onChange: (v: string | string[]) => void;
}) {
  return (
    <fieldset
      className={"question " + (error ? "has-error" : "")}
      aria-describedby={error ? `${q.id}-error` : undefined}
    >
      <legend>
        {q.label}
        {q.required && <span aria-label="verplicht"> *</span>}
      </legend>
      {q.type === "text" ? (
        <input
          id={q.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={q.label}
          aria-invalid={!!error}
          autoComplete={q.id === "postcode" ? "postal-code" : "off"}
          placeholder={
            q.id === "postcode"
              ? "Bijv. 1234 AB"
              : q.id === "house_number"
                ? "Bijv. 12 A"
                : ""
          }
          maxLength={500}
        />
      ) : (
        <div className={"choices " + (q.options.length > 4 ? "compact" : "")}>
          {q.options.map((o) => (
            <label className="choice" key={o.id}>
              <input
                type={q.type === "single" ? "radio" : "checkbox"}
                name={q.id}
                checked={
                  q.type === "single"
                    ? value === o.id
                    : Array.isArray(value) && value.includes(o.id)
                }
                onChange={() =>
                  onChange(
                    q.type === "single"
                      ? o.id
                      : Array.isArray(value) && value.includes(o.id)
                        ? value.filter((v) => v !== o.id)
                        : [...(Array.isArray(value) ? value : []), o.id],
                  )
                }
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
      {error && (
        <p id={`${q.id}-error`} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
function QuestionnaireForm({ config }: { config: Config }) {
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [a, setA] = useState<Answers>({});
  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    street: "",
    city: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    number: number;
    indication: keyof typeof resultText;
  } | null>(null);
  const [website, setWebsite] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    request("/questionnaire")
      .then((data) =>
        setQ((existing) => existing ?? validateQuestionnaire(data)),
      )
      .catch(() =>
        setError(
          "De vragenlijst kan niet worden geladen. Probeer het later opnieuw.",
        ),
      );
  }, []);
  useEffect(() => {
    if (step > 1) heading.current?.focus();
  }, [step]);
  function update(id: string, value: string | string[]) {
    if (!q) return;
    setA(cleanAnswers(q, { ...a, [id]: value }));
    setErrors({});
  }
  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!q) return;
    setError("");
    const fields = answerErrors(q, a, step);
    if (step === 4) {
      const parsed = contactSchema.safeParse(contact);
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          fields[String(issue.path[0])] = "Vul geldige contactgegevens in.";
    }
    setErrors(fields);
    if (Object.keys(fields).length) {
      setError("Controleer de gemarkeerde velden.");
      return;
    }
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      const data = await request("/applications", {
        method: "POST",
        body: JSON.stringify({
          version_id: q.id,
          idempotency_key: key,
          answers: a,
          contact,
          website,
        }),
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message);
      if (e.fields) setErrors(e.fields);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-card" aria-label="Gratis mijnbouwschadecheck">
      {result ? (
        <div className="result" role="status">
          <span className="result-icon">✓</span>
          <span className="eyebrow">AANVRAAG ONTVANGEN · #{result.number}</span>
          <h2>Dank je voor je vertrouwen.</h2>
          <p>{resultText[result.indication]}</p>
          <p className="notice">
            Deze check geeft een voorlopige indicatie en is geen officiële
            beoordeling of garantie op vergoeding.
          </p>
        </div>
      ) : (
        <>
          <div className="card-top">
            <span className="eyebrow">DE GRATIS CHECK</span>
            <span className="step-count">Stap {step} van 4</span>
          </div>
          <div className="progress" aria-label={`Stap ${step} van 4`}>
            {["Je woning", "De schade", "Tot slot", "Contact"].map(
              (label, i) => (
                <div key={label} className={step >= i + 1 ? "active" : ""}>
                  <span />
                  <small>{label}</small>
                </div>
              ),
            )}
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {
              [
                "Vertel over je woning.",
                "Welke schade zie je?",
                "Nog één vraag.",
                "Hoe bereiken we je?",
              ][step - 1]
            }
          </h2>
          <p className="form-intro">
            {step === 4
              ? "Je gegevens worden gebruikt voor persoonlijke controle en opvolging van je aanvraag."
              : "Een eerste indruk begint bij jouw verhaal. Velden met * zijn verplicht."}
          </p>
          {!config.configured && (
            <p className="notice">
              Demonstratie: opslag en beheer zijn nog niet aangesloten. Je kunt
              de vragen bekijken, maar geen aanvraag versturen.
            </p>
          )}
          <form onSubmit={next} noValidate>
            {q?.questions
              .filter((x) => x.step === step && visible(x, a, q.questions))
              .map((question) => (
                <QuestionField
                  key={question.id}
                  q={question}
                  value={a[question.id]}
                  error={errors[question.id]}
                  onChange={(value) => update(question.id, value)}
                />
              ))}
            {step === 4 && (
              <>
                <div className="address-summary">
                  <strong>Schadeadres</strong>
                  <span>
                    {a.postcode} · huisnummer {a.house_number}
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStep(1)}
                  >
                    Wijzigen
                  </button>
                </div>
                {Object.entries({
                  name: "Naam",
                  email: "E-mailadres",
                  phone: "Telefoonnummer",
                  street: "Straat",
                  city: "Woonplaats",
                }).map(([id, label]) => (
                  <div className="contact-field" key={id}>
                    <label htmlFor={id}>{label} *</label>
                    <input
                      id={id}
                      type={
                        id === "email"
                          ? "email"
                          : id === "phone"
                            ? "tel"
                            : "text"
                      }
                      autoComplete={
                        (
                          {
                            name: "name",
                            email: "email",
                            phone: "tel",
                            street: "address-line1",
                            city: "address-level2",
                          } as Record<string, string>
                        )[id]
                      }
                      value={contact[id as keyof typeof contact]}
                      onChange={(e) =>
                        setContact({ ...contact, [id]: e.target.value })
                      }
                      aria-invalid={!!errors[id]}
                    />
                    {errors[id] && <p className="field-error">{errors[id]}</p>}
                  </div>
                ))}
                <p className="privacy-note">
                  Door je aanvraag te versturen vraag je om persoonlijke
                  opvolging. Lees hoe we je gegevens gebruiken in onze{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer">
                    privacyinformatie
                  </a>
                  . Geen marketinginschrijving.
                </p>
              </>
            )}
            <div className="honeypot" aria-hidden="true">
              <label>
                Website
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </label>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              {step > 1 && (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                    setErrors({});
                  }}
                >
                  ← Terug
                </button>
              )}
              <button
                className="primary"
                disabled={busy || !q || (step === 4 && !config.configured)}
              >
                {busy
                  ? "Aanvraag wordt verstuurd…"
                  : step === 4
                    ? "Verstuur & bekijk indicatie"
                    : "Volgende stap →"}
              </button>
            </div>
            <p className="secure-note">
              ◇ Je antwoorden blijven in dit formulier tot je ze verstuurt.
            </p>
          </form>
        </>
      )}
    </section>
  );
}
function Privacy({ config }: { config: Config }) {
  return (
    <section className="page">
      <span className="eyebrow">ZORGVULDIG MET JE GEGEVENS</span>
      <h1>Privacyinformatie.</h1>
      {!config.privacyApproved && (
        <p className="notice">
          Concept — de eigenaar moet deze informatie en de juridische grondslag
          vóór livegang vaststellen.
        </p>
      )}
      <h2>Wie verwerkt je gegevens?</h2>
      <p>
        {config.company}, een onafhankelijk adviesbureau.{" "}
        {config.companyDetails}{" "}
        {config.privacyContact ||
          "Naam van de verantwoordelijke, bedrijfsgegevens en privacycontact moeten nog worden ingevuld."}
      </p>
      <h2>Wat verzamelen we en waarom?</h2>
      <p>
        Je naam, e-mailadres, telefoonnummer, schadeadres en antwoorden worden
        gebruikt om je aanvraag persoonlijk te controleren en contact met je op
        te nemen. We verzamelen geen BSN of foto’s. We verkopen of verspreiden
        je aanvraag niet.
      </p>
      <h2>Grondslag en bewaartermijn</h2>
      <p>
        {config.legalBasis ||
          "De juridische grondslag moet door de eigenaar worden vastgesteld."}{" "}
        {config.retention
          ? `De ingestelde bewaartermijn is ${config.retention} dagen; gecontroleerde verwijdering is mogelijk via beheer.`
          : "De bewaartermijn moet nog worden vastgesteld. Automatische verwijdering is niet geactiveerd."}
      </p>
      <h2>Beveiliging en dienstverleners</h2>
      <p>
        Alleen de geautoriseerde beheerder heeft toegang tot aanvragen. Onze
        eigen server en PostgreSQL-database verzorgen opslag en authenticatie;
        de ingestelde e-maildienst verstuurt alleen een aanvraagnummer en een
        beveiligde beheerlink in de melding.{" "}
        {config.processors ||
          "Verwerkersafspraken en doorgiftevoorwaarden moeten vóór livegang worden vastgesteld."}
      </p>
      <h2>Jouw rechten</h2>
      <p>
        Je kunt verzoeken om inzage, correctie of verwijdering. Je kunt bezwaar
        maken of beperking van verwerking verzoeken en een klacht indienen bij
        de Autoriteit Persoonsgegevens. Neem contact op via{" "}
        {config.privacyContact || "het nog vast te stellen privacycontact"}.
      </p>
      <h2>Cookies en tracking</h2>
      <p>
        De publieke check gebruikt geen analytics of trackingcookies. Antwoorden
        blijven in geheugen tot verzending. Alleen de beheeromgeving gebruikt
        sessieopslag voor authenticatie.
      </p>
    </section>
  );
}
function Admin({ config }: { config: Config }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("applications");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("reset") ?? "",
  );
  useEffect(() => {
    if (resetToken) history.replaceState(null, "", location.pathname);
    request("/auth/session")
      .then((r) => setAuthenticated(r.authenticated))
      .catch(() => {});
  }, []);
  async function action(fn: () => Promise<void>) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin page">
      <span className="eyebrow">BEVEILIGDE BEHEEROMGEVING</span>
      <h1>Persoonlijke opvolging.</h1>
      {!config.configured ? (
        <p className="notice">
          De database is nog niet geconfigureerd. Er worden geen aanvragen
          getoond.
        </p>
      ) : resetToken ? (
        <form
          className="login"
          onSubmit={(e) => {
            e.preventDefault();
            action(async () => {
              await request("/auth/reset", {
                method: "POST",
                body: JSON.stringify({ token: resetToken, password, code }),
              });
              setResetToken("");
              setPassword("");
              setMessage("Wachtwoord bijgewerkt. Log opnieuw in.");
            });
          }}
        >
          <label>
            Nieuw wachtwoord
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Authenticatiecode (indien ingesteld)
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Wachtwoord opslaan
          </button>
        </form>
      ) : !authenticated ? (
        <form
          className="login"
          onSubmit={(e) => {
            e.preventDefault();
            action(async () => {
              await request("/auth/login", {
                method: "POST",
                body: JSON.stringify({ email, password, code }),
              });
              setAuthenticated(true);
              setPassword("");
              setCode("");
            });
          }}
        >
          <label>
            E-mailadres
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Wachtwoord
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label>
            Authenticatiecode (indien ingesteld)
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Inloggen
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                await request("/auth/recover", {
                  method: "POST",
                  body: JSON.stringify({ email }),
                });
                setMessage(
                  "Herstelinstructies aangevraagd. Ontvang je geen bericht, controleer je spammap of neem contact op met de serverbeheerder.",
                );
              })
            }
          >
            Wachtwoord vergeten?
          </button>
        </form>
      ) : (
        <>
          <div className="admin-toolbar">
            <button
              onClick={() => setTab("applications")}
              className={tab === "applications" ? "primary" : "secondary"}
            >
              Aanvragen
            </button>
            <button
              onClick={() => setTab("questionnaires")}
              className={tab === "questionnaires" ? "primary" : "secondary"}
            >
              Vragenlijst
            </button>
            <button
              className="text-button"
              onClick={() =>
                action(async () => {
                  await request("/auth/logout", { method: "POST", body: "{}" });
                  setAuthenticated(false);
                })
              }
            >
              Uitloggen
            </button>
          </div>
          {tab === "applications" ? (
            <Applications token="" />
          ) : (
            <QuestionnaireEditor token="" />
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
function Applications({ token }: { token: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [indication, setIndication] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  async function load() {
    try {
      const r = await request(
        `/admin/applications?${new URLSearchParams({ page: String(page), search, status, indication })}`,
        {},
        token,
      );
      setItems(r.items);
      setCount(r.count);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [token, page, status, indication]);
  async function select(id: string) {
    try {
      const detail = await request("/admin/applications/" + id, {}, token);
      setSelected({ ...detail, saved_review_status: detail.review_status });
      setConfirm("");
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {selected ? (
        <>
          <button
            className="text-button"
            onClick={() => {
              setSelected(null);
              load();
            }}
          >
            ← Alle aanvragen
          </button>
          <h2>Aanvraag #{selected.number}</h2>
          <p>
            {new Date(selected.created_at).toLocaleString("nl-NL")} ·
            vragenlijstversie {selected.questionnaire_snapshot.version}
          </p>
          <div className="detail-grid">
            <section className="detail-card">
              <h3>Contact en schadeadres</h3>
              <p>
                {selected.contact.name}
                <br />
                {selected.contact.email}
                <br />
                {selected.contact.phone}
              </p>
              <p>
                {selected.address.street} {selected.address.house_number}
                <br />
                {selected.address.postcode} {selected.address.city}
              </p>
              {selected.saved_review_status === "Gecontroleerd" ? (
                <div className="contact-actions">
                  <a href={"mailto:" + selected.contact.email}>
                    E-mail opstellen ↗
                  </a>
                  <a href={"tel:" + selected.contact.phone}>Bellen ↗</a>
                </div>
              ) : (
                <p className="notice">
                  Contactacties zijn beschikbaar na persoonlijke controle.
                </p>
              )}
              <p>
                Notificatie: {selected.notification?.status ?? "onbekend"} ·{" "}
                {selected.notification?.attempts ?? 0} pogingen
              </p>
            </section>
            <form
              className="detail-card"
              onSubmit={async (e) => {
                e.preventDefault();
                if (saving) return;
                setSaving(true);
                setMessage("");
                try {
                  await request(
                    "/admin/applications/" + selected.id,
                    {
                      method: "PATCH",
                      body: JSON.stringify({
                        status: selected.status,
                        review_status: selected.review_status,
                        note: selected.note,
                      }),
                    },
                    token,
                  );
                  await select(selected.id);
                  setMessage("Wijzigingen opgeslagen.");
                } catch (e: any) {
                  setError(e.message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <label>
                Leadstatus
                <select
                  value={selected.status}
                  onChange={(e) =>
                    setSelected({ ...selected, status: e.target.value })
                  }
                >
                  {["Nieuw", "In behandeling", "Afgerond"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Persoonlijke controle
                <select
                  value={selected.review_status}
                  onChange={(e) =>
                    setSelected({ ...selected, review_status: e.target.value })
                  }
                >
                  {["Nog te controleren", "Gecontroleerd"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <p>
                {selected.reviewed_at &&
                  `Gecontroleerd op ${new Date(selected.reviewed_at).toLocaleString("nl-NL")} door ${selected.reviewed_by}`}
              </p>
              <label>
                Interne beoordelingsnotitie
                <textarea
                  value={selected.note}
                  onChange={(e) =>
                    setSelected({ ...selected, note: e.target.value })
                  }
                  maxLength={10000}
                />
              </label>
              <button className="primary" disabled={saving}>
                {saving ? "Bezig met opslaan…" : "Opslaan"}
              </button>
            </form>
          </div>
          <h3>Voorlopige indicatie</h3>
          <p>{resultText[selected.indication as keyof typeof resultText]}</p>
          <ul>
            {selected.reasons.map((r: any) => (
              <li key={r.question_id + r.option_id}>
                {r.question}: {r.answer}
              </li>
            ))}
          </ul>
          <h3>Antwoorden op het moment van indienen</h3>
          <dl>
            {selected.answers.map((a: any) => (
              <React.Fragment key={a.question_id}>
                <dt>{a.question}</dt>
                <dd>
                  {Array.isArray(a.answer)
                    ? a.answer.join(", ") || "Niet ingevuld"
                    : a.answer || "Niet ingevuld"}
                </dd>
              </React.Fragment>
            ))}
          </dl>
          <details className="delete-panel">
            <summary>Aanvraag en bijbehorende gegevens verwijderen</summary>
            <p>
              Deze actie verwijdert ook antwoorden, notities, wijzigingslog en
              notificatieverwijzingen. Dit kan niet worden teruggedraaid.
            </p>
            <label>
              Typ VERWIJDER
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <button
              className="danger"
              disabled={confirm !== "VERWIJDER"}
              onClick={async () => {
                try {
                  await request(
                    "/admin/applications/" + selected.id,
                    { method: "DELETE", body: JSON.stringify({ confirm }) },
                    token,
                  );
                  setSelected(null);
                  setMessage("Aanvraag verwijderd.");
                  load();
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              Definitief verwijderen
            </button>
          </details>
        </>
      ) : (
        <>
          <form
            className="filters"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              load();
            }}
          >
            <label>
              Zoeken op naam of adres
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Naam, postcode of straat"
              />
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value);
                }}
              >
                <option value="">Alle statussen</option>
                {["Nieuw", "In behandeling", "Afgerond"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Indicatie
              <select
                value={indication}
                onChange={(e) => {
                  setPage(1);
                  setIndication(e.target.value);
                }}
              >
                <option value="">Alle indicaties</option>
                <option value="possible">Aanwijzingen aanwezig</option>
                <option value="review_needed">Persoonlijk beoordelen</option>
              </select>
            </label>
            <button className="primary">Zoeken</button>
          </form>
          <p>{count} aanvragen</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    "Nummer",
                    "Datum",
                    "Naam",
                    "Schadeadres",
                    "Indicatie",
                    "Status",
                    "Controle",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => select(i.id)}
                      >
                        #{i.number}
                      </button>
                    </td>
                    <td>
                      {new Date(i.created_at).toLocaleDateString("nl-NL")}
                    </td>
                    <td>{i.contact.name}</td>
                    <td>
                      {i.address.street} {i.address.house_number},{" "}
                      {i.address.postcode} {i.address.city}
                    </td>
                    <td>
                      {i.indication === "possible"
                        ? "Aanwijzingen"
                        : "Beoordelen"}
                    </td>
                    <td>{i.status}</td>
                    <td>{i.review_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!items.length && <p>Geen aanvragen gevonden.</p>}
          <div className="form-actions">
            <button
              className="secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Vorige
            </button>
            <span>Pagina {page}</span>
            <button
              className="secondary"
              disabled={page * 20 >= count}
              onClick={() => setPage(page + 1)}
            >
              Volgende
            </button>
          </div>
        </>
      )}
    </div>
  );
}
function QuestionnaireEditor({ token }: { token: string }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [saved, setSaved] = useState(false);
  async function load() {
    try {
      setVersions(await request("/admin/questionnaires", {}, token));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    load();
  }, [token]);
  function edit(next: Questionnaire) {
    setQ(next);
    setSaved(false);
    setMessage("");
  }
  function change(index: number, patch: Partial<Question>) {
    if (q)
      edit({
        ...q,
        questions: q.questions.map((x, i) =>
          i === index ? { ...x, ...patch } : x,
        ),
      });
  }
  async function save() {
    try {
      const valid = validateQuestionnaire(q);
      await request(
        "/admin/questionnaires/" + valid.id,
        { method: "PUT", body: JSON.stringify(valid) },
        token,
      );
      setSaved(true);
      setError("");
      setMessage("Concept opgeslagen. Bekijk de preview vóór publicatie.");
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <div>
      <h2>Vragenlijstbeheer</h2>
      <p>
        Actieve versies zijn onveranderlijk. Bewerken maakt een concept. Oude
        aanvragen en lopende formulieren behouden hun versie.
      </p>
      <p className="notice">
        Voorgestelde bedrijfsregel versie 1: één of meer positieve signalen
        geeft “possible”; anders “review_needed”. Dit is geen juridisch
        gevalideerde beslisregel. De basisvelden voor adres en conditionele
        schade blijven beschermd.
      </p>
      <div className="version-list">
        {versions.map((v) => (
          <div key={v.id}>
            <span>
              Versie {v.state === "draft" ? "concept" : v.version} · {v.state}
            </span>
            <button
              className="secondary"
              onClick={() => {
                setQ(
                  v.state === "draft"
                    ? v.definition
                    : {
                        ...v.definition,
                        id: crypto.randomUUID(),
                        version: Math.max(1, v.version + 1),
                      },
                );
                setSaved(v.state === "draft");
                setPreview(false);
                setAnswers({});
              }}
            >
              {" "}
              {v.state === "draft" ? "Concept openen" : "Nieuwe versie maken"}
            </button>
          </div>
        ))}
      </div>
      {q && (
        <>
          <div className="admin-toolbar">
            <button className="secondary" onClick={() => setPreview(!preview)}>
              {preview ? "Terug naar bewerken" : "Preview"}
            </button>
            <button className="primary" onClick={save}>
              Concept opslaan
            </button>
            <button
              className="primary"
              disabled={!saved || !preview}
              onClick={async () => {
                try {
                  await request(
                    "/admin/questionnaires/" + q.id + "/publish",
                    { method: "POST", body: "{}" },
                    token,
                  );
                  setQ(null);
                  setMessage("Nieuwe versie gepubliceerd.");
                  load();
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              Publiceren
            </button>
          </div>
          {preview ? (
            <section className="preview">
              <h3>Preview — er worden geen gegevens opgeslagen</h3>
              {q.questions
                .filter((x) => visible(x, answers, q.questions))
                .map((question) => (
                  <QuestionField
                    key={question.id}
                    q={question}
                    value={answers[question.id]}
                    onChange={(v) =>
                      setAnswers(
                        cleanAnswers(q, { ...answers, [question.id]: v }),
                      )
                    }
                  />
                ))}
            </section>
          ) : (
            <>
              {q.questions.map((question, i) => (
                <details className="editor-question" key={question.id}>
                  <summary>
                    {i + 1}. {question.label}
                  </summary>
                  <p>Stabiele ID: {question.id}</p>
                  <label>
                    Vraagtekst
                    <input
                      value={question.label}
                      onChange={(e) => change(i, { label: e.target.value })}
                    />
                  </label>
                  <div className="editor-row">
                    <label>
                      Type
                      <select
                        value={question.type}
                        onChange={(e) =>
                          change(i, {
                            type: e.target.value as Question["type"],
                            options:
                              e.target.value === "text"
                                ? []
                                : question.options.length
                                  ? question.options
                                  : [
                                      {
                                        id: crypto.randomUUID(),
                                        label: "Nieuwe optie",
                                      },
                                    ],
                          })
                        }
                      >
                        <option value="text">Tekst</option>
                        <option value="single">Enkelvoudige keuze</option>
                        <option value="multi">Meervoudige keuze</option>
                      </select>
                    </label>
                    <label>
                      Stap
                      <select
                        value={question.step}
                        onChange={(e) =>
                          change(i, { step: Number(e.target.value) })
                        }
                      >
                        {[1, 2, 3].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label className="check-inline">
                      <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(e) =>
                          change(i, { required: e.target.checked })
                        }
                      />
                      Verplicht
                    </label>
                  </div>
                  {question.type !== "text" && (
                    <>
                      <h4>Antwoordopties</h4>
                      {question.options.map((o, j) => (
                        <div className="option-edit" key={o.id}>
                          <input
                            aria-label="Optietekst"
                            value={o.label}
                            onChange={(e) =>
                              change(i, {
                                options: question.options.map((x, k) =>
                                  k === j ? { ...x, label: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <label className="check-inline">
                            <input
                              type="checkbox"
                              checked={!!o.positive}
                              onChange={(e) =>
                                change(i, {
                                  options: question.options.map((x, k) =>
                                    k === j
                                      ? { ...x, positive: e.target.checked }
                                      : x,
                                  ),
                                })
                              }
                            />
                            Positief signaal
                          </label>
                          <button
                            className="text-button"
                            onClick={() =>
                              change(i, {
                                options: question.options.filter(
                                  (_, k) => k !== j,
                                ),
                              })
                            }
                          >
                            Verwijderen
                          </button>
                          <button
                            className="text-button"
                            disabled={j === 0}
                            onClick={() => {
                              const options = [...question.options];
                              [options[j - 1], options[j]] = [
                                options[j],
                                options[j - 1],
                              ];
                              change(i, { options });
                            }}
                          >
                            ↑
                          </button>
                        </div>
                      ))}
                      <button
                        className="secondary"
                        onClick={() =>
                          change(i, {
                            options: [
                              ...question.options,
                              {
                                id: crypto.randomUUID(),
                                label: "Nieuwe optie",
                              },
                            ],
                          })
                        }
                      >
                        Optie toevoegen
                      </button>
                    </>
                  )}
                  <h4>Zichtbaarheid</h4>
                  <label>
                    Toon wanneer antwoord op
                    <select
                      value={question.visible?.question ?? ""}
                      onChange={(e) => {
                        const parent = q.questions.find(
                          (x) => x.id === e.target.value,
                        );
                        change(i, {
                          visible: parent
                            ? {
                                question: parent.id,
                                options: [parent.options[0].id],
                              }
                            : undefined,
                        });
                      }}
                    >
                      <option value="">Altijd zichtbaar</option>
                      {q.questions
                        .filter(
                          (x) => x.id !== question.id && x.type !== "text",
                        )
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  {question.visible &&
                    q.questions
                      .find((x) => x.id === question.visible!.question)
                      ?.options.map((o) => (
                        <label className="check-inline" key={o.id}>
                          <input
                            type="checkbox"
                            checked={question.visible!.options.includes(o.id)}
                            onChange={(e) =>
                              change(i, {
                                visible: {
                                  ...question.visible!,
                                  options: e.target.checked
                                    ? [...question.visible!.options, o.id]
                                    : question.visible!.options.filter(
                                        (x) => x !== o.id,
                                      ),
                                },
                              })
                            }
                          />
                          {o.label}
                        </label>
                      ))}
                  <div className="admin-toolbar">
                    <button
                      className="secondary"
                      disabled={i === 0}
                      onClick={() => {
                        const questions = [...q.questions];
                        [questions[i - 1], questions[i]] = [
                          questions[i],
                          questions[i - 1],
                        ];
                        edit({ ...q, questions });
                      }}
                    >
                      ↑ Omhoog
                    </button>
                    <button
                      className="secondary"
                      disabled={i === q.questions.length - 1}
                      onClick={() => {
                        const questions = [...q.questions];
                        [questions[i + 1], questions[i]] = [
                          questions[i],
                          questions[i + 1],
                        ];
                        edit({ ...q, questions });
                      }}
                    >
                      ↓ Omlaag
                    </button>
                    <button
                      className="danger"
                      onClick={() =>
                        edit({
                          ...q,
                          questions: q.questions.filter((_, k) => k !== i),
                        })
                      }
                    >
                      Vraag verwijderen uit concept
                    </button>
                  </div>
                </details>
              ))}
              <button
                className="secondary"
                onClick={() =>
                  edit({
                    ...q,
                    questions: [
                      ...q.questions,
                      {
                        id: "q_" + crypto.randomUUID().replace(/-/g, ""),
                        label: "Nieuwe vraag",
                        step: 3,
                        type: "text",
                        required: false,
                        options: [],
                      },
                    ],
                  })
                }
              >
                Vraag toevoegen
              </button>
            </>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
