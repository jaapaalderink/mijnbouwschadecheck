import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const origin = process.env.E2E_BASE_URL ?? "http://localhost:3001";
test("publieke flow: validatie, conditionele schade, teruggaan, opslag en resultaat", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Schade aan je woning? Begin met duidelijkheid.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Volgende stap" }).click();
  await expect(page.getByRole("alert")).toContainText("Controleer");
  await page
    .getByRole("textbox", { name: "Wat is je postcode?" })
    .fill("1234 ab");
  await page
    .getByRole("textbox", { name: /Wat is je huisnummer/ })
    .fill("12 A");
  await page.getByLabel("1990 - heden", { exact: true }).check();
  await page.getByLabel("Vrijstaande woning", { exact: true }).check();
  await page.getByLabel("60 - 100 m²", { exact: true }).check();
  await page.getByRole("button", { name: "Volgende stap" }).click();
  await page.getByLabel("Ja, duidelijk zichtbaar", { exact: true }).check();
  await page.getByRole("button", { name: "Volgende stap" }).click();
  await expect(
    page.getByText("Vul dit veld in.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Binnenmuren", { exact: true }).check();
  await page.getByLabel("Nee", { exact: true }).check();
  await expect(page.getByLabel("Binnenmuren", { exact: true })).toHaveCount(0);
  await page.getByLabel("Ja, duidelijk zichtbaar", { exact: true }).check();
  await expect(
    page.getByLabel("Binnenmuren", { exact: true }),
  ).not.toBeChecked();
  await page.getByLabel("Nee", { exact: true }).check();
  await page.getByRole("button", { name: "Terug" }).click();
  await expect(
    page.getByRole("textbox", { name: "Wat is je postcode?" }),
  ).toHaveValue("1234 ab");
  await page.getByRole("button", { name: "Volgende stap" }).click();
  await page.getByRole("button", { name: "Volgende stap" }).click();
  await page.getByLabel("Nee", { exact: true }).check();
  await page.getByRole("button", { name: "Volgende stap" }).click();
  for (const [label, value] of [
    ["Naam", "Test Aanvrager"],
    ["E-mailadres", "test@example.invalid"],
    ["Telefoonnummer", "0612345678"],
    ["Straat", "Teststraat"],
    ["Woonplaats", "Testplaats"],
  ])
    await page
      .getByRole("textbox", { name: label + " *", exact: true })
      .fill(value);
  await page
    .getByRole("button", { name: "Verstuur & bekijk indicatie" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dank je voor je vertrouwen." }),
  ).toBeVisible();
  await expect(
    page.getByText("Op basis van deze korte check kunnen we niet aangeven", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveText(/STORAGE_UNAVAILABLE/);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.evaluate(() => document.body.clientWidth),
  );
});
test("beheer is afgeschermd en controle blijft apart van status", async ({
  page,
  request,
}) => {
  const questionnaire = await (await request.get("/api/questionnaire")).json();
  const fixture = await request.post("/api/applications", {
    headers: { Origin: origin },
    data: {
      version_id: questionnaire.id,
      idempotency_key: crypto.randomUUID(),
      answers: {
        postcode: "1234 AB",
        house_number: "12",
        year: "o3",
        home: "o1",
        size: "o2",
        damage: "o4",
        previous: "o3",
      },
      contact: {
        name: "Test Beheer",
        email: "test@example.invalid",
        phone: "0612345678",
        street: "Teststraat",
        city: "Testplaats",
      },
      website: "",
    },
  });
  expect(fixture.status()).toBe(201);
  const unauthorized = await request.get("/api/admin/applications");
  expect(unauthorized.status()).toBe(401);
  await page.goto("/beheer");
  await page
    .getByLabel("E-mailadres", { exact: true })
    .fill(process.env.E2E_ADMIN_EMAIL ?? "admin@example.invalid");
  await page
    .getByLabel("Wachtwoord", { exact: true })
    .fill(process.env.E2E_ADMIN_PASSWORD ?? "test-only-password-123");
  await page.getByRole("button", { name: "Inloggen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Persoonlijke opvolging." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^#\d+$/ })
    .first()
    .click();
  await expect(
    page.getByText("Contactacties zijn beschikbaar na persoonlijke controle."),
  ).toBeVisible();
  await page.getByLabel("Leadstatus").selectOption("Afgerond");
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByText("Wijzigingen opgeslagen.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Contactacties zijn beschikbaar na persoonlijke controle."),
  ).toBeVisible();
  await page.getByLabel("Persoonlijke controle").selectOption("Gecontroleerd");
  await expect(
    page.getByRole("link", { name: "E-mail opstellen" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Opslaan", exact: true }).click();
  await expect(
    page.getByText("Wijzigingen opgeslagen.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "E-mail opstellen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Uitloggen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Inloggen", exact: true }),
  ).toBeVisible();
});
test("API blokkeert vervalsing en cross-site mutaties", async ({ request }) => {
  const q = await (await request.get("/api/questionnaire")).json();
  const payload = {
    version_id: q.id,
    idempotency_key: crypto.randomUUID(),
    answers: {},
    contact: {},
    indication: "possible",
  };
  expect(
    (
      await request.post("/api/applications", {
        headers: { Origin: origin },
        data: payload,
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: "https://attacker.invalid" },
        data: { email: "admin@example.invalid", password: "anything" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: {
          email: "non-admin@example.invalid",
          password: "test-only-password-123",
        },
      })
    ).status(),
  ).toBe(401);
});
test("toetsenbord en privacy", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Direct naar inhoud" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Privacyinformatie." }),
  ).toBeVisible();
  await expect(page.getByText("Concept —", { exact: false })).toBeVisible();
});

test("toegankelijkheid zonder ernstige WCAG-overtredingen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Wat is je postcode?" }).waitFor();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
});

test("idempotente parallelle retries en versiebeheer via beheer", async ({
  request,
  page,
}) => {
  const questionnaire = await (await request.get("/api/questionnaire")).json();
  const marker = `Test ${crypto.randomUUID()}`;
  const payload = {
    version_id: questionnaire.id,
    idempotency_key: crypto.randomUUID(),
    answers: {
      postcode: "1234 AB",
      house_number: "12",
      year: "o3",
      home: "o1",
      size: "o2",
      damage: "o4",
      previous: "o3",
    },
    contact: {
      name: marker,
      email: "test@example.invalid",
      phone: "0612345678",
      street: "Teststraat",
      city: "Testplaats",
    },
    website: "",
  };
  const responses = await Promise.all([
    request.post("/api/applications", {
      headers: { Origin: origin },
      data: payload,
    }),
    request.post("/api/applications", {
      headers: { Origin: origin },
      data: payload,
    }),
  ]);
  expect(responses.map((r) => r.status())).toEqual([201, 201]);
  expect(await responses[0].json()).toEqual(await responses[1].json());
  const login = await request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: {
      email: process.env.E2E_ADMIN_EMAIL ?? "admin@example.invalid",
      password: process.env.E2E_ADMIN_PASSWORD ?? "test-only-password-123",
    },
  });
  expect(login.status()).toBe(200);
  const saved = await (
    await request.get(
      "/api/admin/applications?search=" + encodeURIComponent(marker),
    )
  ).json();
  expect(saved.count).toBe(1);
  const draft = {
    ...structuredClone(questionnaire),
    id: crypto.randomUUID(),
    version: questionnaire.version + 1,
  };
  draft.questions.find((q: any) => q.id === "year").options[2].label =
    "1990 - heden (nieuwe versie)";
  const headers = { Origin: origin };
  expect(
    (
      await request.put("/api/admin/questionnaires/" + draft.id, {
        headers,
        data: draft,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/admin/questionnaires/" + draft.id + "/publish", {
        headers,
        data: {},
      })
    ).status(),
  ).toBe(200);
  const history = await (
    await request.get("/api/admin/applications/" + saved.items[0].id)
  ).json();
  expect(history.questionnaire_snapshot.id).toBe(questionnaire.id);
  expect(
    history.answers.find((a: any) => a.question_id === "year").answer,
  ).toEqual([
    questionnaire.questions.find((q: any) => q.id === "year").options[2].label,
  ]);
  expect(
    (
      await request.put("/api/admin/questionnaires/" + draft.id, {
        headers,
        data: draft,
      })
    ).status(),
  ).toBe(409);
  // Restore the initial wording as a new immutable version; never mutate history.
  const restore = {
    ...structuredClone(questionnaire),
    id: crypto.randomUUID(),
    version: questionnaire.version + 2,
  };
  expect(
    (
      await request.put("/api/admin/questionnaires/" + restore.id, {
        headers,
        data: restore,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post(
        "/api/admin/questionnaires/" + restore.id + "/publish",
        { headers, data: {} },
      )
    ).status(),
  ).toBe(200);
});

test("SMTP-herstel met eenmalige token en ingetrokken sessie", async ({
  request,
}) => {
  test.skip(
    !process.env.E2E_MAILPIT_URL,
    "Lokale Mailpit-testserver niet ingesteld.",
  );
  const email = process.env.E2E_ADMIN_EMAIL ?? "admin@example.invalid";
  const password = process.env.E2E_ADMIN_PASSWORD ?? "test-only-password-123";
  const headers = { Origin: origin };
  expect(
    (
      await request.post("/api/auth/login", {
        headers,
        data: { email, password },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/auth/recover", { headers, data: { email } })
    ).status(),
  ).toBe(200);
  const mails = await (
    await request.get(process.env.E2E_MAILPIT_URL + "/api/v1/messages")
  ).json();
  const mail = mails.messages.find(
    (m: any) => m.Subject === "Wachtwoord herstellen",
  );
  expect(mail).toBeTruthy();
  const detail = await (
    await request.get(
      process.env.E2E_MAILPIT_URL + "/api/v1/message/" + mail.ID,
    )
  ).json();
  const token = detail.Text.match(/#reset=([a-f0-9]{64})/)[1];
  expect(
    (
      await request.post("/api/auth/reset", {
        headers,
        data: { token, password },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get("/api/admin/applications")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/reset", {
        headers,
        data: { token, password },
      })
    ).status(),
  ).toBe(400);
});
