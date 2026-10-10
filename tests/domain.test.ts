import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  initial,
  prepareSubmission,
  cleanAnswers,
  answerErrors,
  validateQuestionnaire,
} from "../src/domain.ts";
import { deliverNotification } from "../server/outbox.ts";
import {
  hashPassword,
  verifyPassword,
  totp,
  verifyTotp,
} from "../server/auth.ts";
export const base = () => ({
  version_id: initial.id,
  idempotency_key: randomUUID(),
  answers: {
    postcode: "1234ab",
    house_number: "12 A",
    year: "o3",
    home: "o1",
    size: "o2",
    damage: "o4",
    previous: "o3",
  },
  contact: {
    name: "Test Aanvrager",
    email: "test@example.invalid",
    phone: "0612345678",
    street: "Teststraat",
    city: "Testplaats",
  },
  website: "",
});
for (const [question, option] of [
  ["year", "o1"],
  ["year", "o2"],
  ["damage", "o1"],
  ["damage", "o2"],
  ["previous", "o1"],
])
  test(`positief signaal ${question}/${option}`, () => {
    const p = base();
    (p.answers as any)[question] = option;
    if (question === "damage") (p.answers as any).locations = ["o1"];
    const r = prepareSubmission(initial, p);
    assert.equal(r.indication, "possible");
    assert.deepEqual(
      r.reasons.map((x) => [x.question_id, x.option_id]),
      [[question, option]],
    );
  });
test("zonder signalen en twijfel blijven persoonlijk te beoordelen", () => {
  assert.equal(prepareSubmission(initial, base()).indication, "review_needed");
  const p = base();
  p.answers.damage = "o3";
  assert.equal(prepareSubmission(initial, p).indication, "review_needed");
});
test("verborgen locaties wissen; zichtbare schade vereist locatie; twijfel niet", () => {
  assert.equal(
    cleanAnswers(initial, { damage: "o4", locations: ["o1"] }).locations,
    undefined,
  );
  assert.ok(
    answerErrors(initial, { ...base().answers, damage: "o1" }).locations,
  );
  assert.equal(
    answerErrors(initial, { ...base().answers, damage: "o3" }).locations,
    undefined,
  );
});
test("ongeldige payloads, types, onbekende IDs en clientindicatie afwijzen", () => {
  for (const p of [
    { ...base(), indication: "possible" },
    { ...base(), answers: { ...base().answers, unknown: "yes" } },
    { ...base(), answers: { ...base().answers, year: "fake" } },
    { ...base(), answers: { ...base().answers, year: ["o1"] } },
    { ...base(), answers: { ...base().answers, postcode: "0000 AA" } },
    { ...base(), contact: { ...base().contact, email: "broken" } },
    { ...base(), website: "spam" },
  ])
    assert.throws(() => prepareSubmission(initial, p));
});
test("normalisatie en snapshots bewaren labels en redenen", () => {
  const p = base();
  p.contact.email = " TEST@example.invalid ";
  const r = prepareSubmission(initial, p);
  assert.equal(r.answers.postcode, "1234 AB");
  assert.equal(r.contact.email, "test@example.invalid");
  assert.equal(
    r.snapshots.find((x) => x.question_id === "year")?.answer[0],
    "1990 - heden",
  );
});
test("cyclus en verwijderde verwijzingen blokkeren publicatie", () => {
  const q = structuredClone(initial);
  q.questions[2].visible = { question: "home", options: ["o1"] };
  q.questions[3].visible = { question: "year", options: ["o1"] };
  assert.throws(() => validateQuestionnaire(q));
  const q2 = structuredClone(initial);
  q2.questions[6].visible!.options = ["missing"];
  assert.throws(() => validateQuestionnaire(q2));
});
test("actieve sessie en oude snapshot blijven ongewijzigd bij nieuwe versie", () => {
  const old = structuredClone(initial);
  const snapshot = prepareSubmission(old, base());
  const next = structuredClone(initial);
  next.id = randomUUID();
  next.questions[2].options[2].label = "Nieuwe tekst";
  assert.equal(old.questions[2].options[2].label, "1990 - heden");
  assert.equal(
    snapshot.snapshots.find((x) => x.question_id === "year")?.answer[0],
    "1990 - heden",
  );
});
test("e-mailstoring herhaalt, behoudt aanvraag, begrenst pogingen", async () => {
  const fail = async () => {
    throw Error("provider down");
  };
  assert.equal((await deliverNotification(fail, 1)).status, "pending");
  assert.equal((await deliverNotification(fail, 5)).status, "failed");
  assert.equal(
    (await deliverNotification(async () => {}, 2)).status,
    "delivered",
  );
});
test("password hashing en RFC 6238 TOTP", () => {
  const hashed = hashPassword("test-only-password");
  assert.ok(verifyPassword("test-only-password", hashed));
  assert.ok(!verifyPassword("wrong", hashed));
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totp(secret, 59000), "287082");
  assert.ok(verifyTotp(secret, "287082", 59000));
  assert.ok(!verifyTotp(secret, "000000", 59000));
});
