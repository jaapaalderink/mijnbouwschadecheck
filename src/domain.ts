import { z } from "zod";
export type Option = { id: string; label: string; positive?: boolean };
export type Question = {
  id: string;
  label: string;
  step: number;
  type: "text" | "single" | "multi";
  required: boolean;
  options: Option[];
  visible?: { question: string; options: string[] };
};
export type Questionnaire = {
  id: string;
  version: number;
  questions: Question[];
  rule: { mode: "any_positive"; proposed: true };
};
const options = (labels: string[], positive: number[] = []) =>
  labels.map((label, i) => ({
    id: `o${i + 1}`,
    label,
    positive: positive.includes(i),
  }));
export const initial: Questionnaire = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  rule: { mode: "any_positive", proposed: true },
  questions: [
    {
      id: "postcode",
      label: "Wat is je postcode?",
      step: 1,
      type: "text",
      required: true,
      options: [],
    },
    {
      id: "house_number",
      label: "Wat is je huisnummer? (inclusief eventuele toevoeging)",
      step: 1,
      type: "text",
      required: true,
      options: [],
    },
    {
      id: "year",
      label: "Uit welk jaar is je woning ongeveer?",
      step: 1,
      type: "single",
      required: true,
      options: options(["Voor 1940", "1940 - 1990", "1990 - heden"], [0, 1]),
    },
    {
      id: "home",
      label: "Wat voor woning heb je?",
      step: 1,
      type: "single",
      required: true,
      options: options([
        "Vrijstaande woning",
        "Twee-onder-een-kap",
        "Hoekwoning",
        "Tussenwoning",
        "Appartement",
        "(Woon)Boerderij",
        "Anders",
      ]),
    },
    {
      id: "size",
      label: "Hoe groot is je woning ongeveer?",
      step: 1,
      type: "single",
      required: true,
      options: options([
        "Kleiner dan 60 m²",
        "60 - 100 m²",
        "100 - 150 m²",
        "Groter dan 150 m²",
      ]),
    },
    {
      id: "damage",
      label:
        "Zie je momenteel scheuren of andere beschadigingen aan je woning?",
      step: 2,
      type: "single",
      required: true,
      options: options(
        ["Ja, duidelijk zichtbaar", "Ja, maar beperkt", "Ik twijfel", "Nee"],
        [0, 1],
      ),
    },
    {
      id: "locations",
      label: "Waar zie je vooral schade?",
      step: 2,
      type: "multi",
      required: false,
      options: options([
        "Binnenmuren",
        "Plafonds",
        "Buitenmuren / gevel",
        "Kozijnen / deuren",
        "Vloeren",
        "Fundering",
        "Anders",
      ]),
      visible: { question: "damage", options: ["o1", "o2", "o3"] },
    },
    {
      id: "previous",
      label:
        "Is er voor dit adres eerder een vergoeding vanuit het IMG ontvangen?",
      step: 3,
      type: "single",
      required: true,
      options: options(
        [
          "Ja, een maatwerk vergoeding",
          "Ja, een vaste vergoeding",
          "Nee",
          "Weet ik niet",
        ],
        [0],
      ),
    },
  ],
};
export const questionnaireSchema = z
  .object({
    id: z.uuid(),
    version: z.number().int().positive(),
    rule: z
      .object({ mode: z.literal("any_positive"), proposed: z.literal(true) })
      .strict(),
    questions: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/),
            label: z.string().min(1).max(500),
            step: z.number().int().min(1).max(3),
            type: z.enum(["text", "single", "multi"]),
            required: z.boolean(),
            options: z
              .array(
                z
                  .object({
                    id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
                    label: z.string().min(1).max(300),
                    positive: z.boolean().optional(),
                  })
                  .strict(),
              )
              .max(50),
            visible: z
              .object({
                question: z.string(),
                options: z.array(z.string()).min(1),
              })
              .strict()
              .optional(),
          })
          .strict(),
      )
      .min(1)
      .max(40),
  })
  .strict();
export function validateQuestionnaire(input: unknown): Questionnaire {
  const q = questionnaireSchema.parse(input);
  const ids = new Set(q.questions.map((x) => x.id));
  if (ids.size !== q.questions.length)
    throw Error("Vraag-ID’s moeten uniek zijn.");
  for (const item of q.questions) {
    if (new Set(item.options.map((o) => o.id)).size !== item.options.length)
      throw Error("Optie-ID’s moeten uniek zijn.");
    if (item.type !== "text" && !item.options.length)
      throw Error("Keuzevragen hebben opties nodig.");
    if (item.type === "text" && item.options.length)
      throw Error("Tekstvragen hebben geen opties.");
    if (item.visible) {
      const parent = q.questions.find((x) => x.id === item.visible!.question);
      if (
        !parent ||
        parent.type === "text" ||
        parent.step > item.step ||
        item.visible.options.some(
          (id) => !parent.options.some((o) => o.id === id),
        )
      )
        throw Error("Ongeldige zichtbaarheid.");
      const visited = new Set([item.id]);
      let cursor: Question | undefined = parent;
      while (cursor) {
        if (visited.has(cursor.id)) throw Error("Cyclische zichtbaarheid.");
        visited.add(cursor.id);
        cursor = cursor.visible
          ? q.questions.find((x) => x.id === cursor!.visible!.question)
          : undefined;
      }
    }
  }
  for (const id of ["postcode", "house_number", "damage", "locations"])
    if (!ids.has(id)) throw Error(`Basisvraag ${id} ontbreekt.`);
  const postcode = q.questions.find((x) => x.id === "postcode")!;
  const house = q.questions.find((x) => x.id === "house_number")!;
  const damage = q.questions.find((x) => x.id === "damage")!;
  const locations = q.questions.find((x) => x.id === "locations")!;
  if (
    postcode.type !== "text" ||
    house.type !== "text" ||
    !postcode.required ||
    !house.required ||
    damage.type !== "single" ||
    !damage.required ||
    locations.type !== "multi" ||
    !["o1", "o2", "o3", "o4"].every((id) =>
      damage.options.some((x) => x.id === id),
    ) ||
    locations.visible?.question !== "damage" ||
    JSON.stringify([...locations.visible.options].sort()) !==
      JSON.stringify(["o1", "o2", "o3"])
  )
    throw Error("De basisvragen voor adres en schade moeten geldig blijven.");
  return q;
}
export type Answers = Record<string, string | string[]>;
export function visible(
  q: Question,
  answers: Answers,
  all?: Question[],
): boolean {
  if (!q.visible) return true;
  const parent = all?.find((x) => x.id === q.visible!.question);
  if (parent && !visible(parent, answers, all)) return false;
  const value = answers[q.visible.question];
  return (Array.isArray(value) ? value : [value]).some((v) =>
    q.visible!.options.includes(v),
  );
}
export function cleanAnswers(q: Questionnaire, a: Answers): Answers {
  const copy = { ...a };
  for (const x of q.questions)
    if (!visible(x, copy, q.questions)) delete copy[x.id];
  return copy;
}
export function answerErrors(q: Questionnaire, a: Answers, step?: number) {
  const errors: Record<string, string> = {};
  for (const question of q.questions) {
    if ((step && question.step !== step) || !visible(question, a, q.questions))
      continue;
    const value = a[question.id];
    const mandatory =
      question.required ||
      (question.id === "locations" && ["o1", "o2"].includes(String(a.damage)));
    if (mandatory && (!value || (Array.isArray(value) && !value.length)))
      errors[question.id] = "Vul dit veld in.";
    if (value !== undefined) {
      if (question.type === "text") {
        if (typeof value !== "string" || value.length > 500)
          errors[question.id] = "Ongeldige tekst.";
      } else {
        const values = Array.isArray(value) ? value : [value];
        if (
          (question.type === "single" && typeof value !== "string") ||
          (question.type === "multi" && !Array.isArray(value)) ||
          new Set(values).size !== values.length ||
          values.some((v) => !question.options.some((o) => o.id === v))
        )
          errors[question.id] = "Kies een geldige optie.";
      }
    }
    if (
      question.id === "postcode" &&
      typeof value === "string" &&
      !/^[1-9][0-9]{3}\s?[A-Za-z]{2}$/.test(value.trim())
    )
      errors[question.id] = "Gebruik een postcode zoals 1234 AB.";
    if (
      question.id === "house_number" &&
      typeof value === "string" &&
      !/^[1-9][0-9]{0,5}(?:\s?[a-zA-Z0-9-]{1,10})?$/.test(value.trim())
    )
      errors[question.id] =
        "Vul een positief huisnummer met eventuele toevoeging in.";
  }
  return errors;
}
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    phone: z
      .string()
      .trim()
      .max(30)
      .transform((v) => v.replace(/[\s()-]/g, ""))
      .refine(
        (v) => /^\+?[0-9]{8,15}$/.test(v),
        "Vul een geldig telefoonnummer in.",
      ),
    street: z.string().trim().min(2).max(150),
    city: z.string().trim().min(2).max(100),
  })
  .strict();
export const submissionSchema = z
  .object({
    version_id: z.uuid(),
    idempotency_key: z.uuid(),
    answers: z.record(
      z.string(),
      z.union([z.string().max(500), z.array(z.string().max(50)).max(50)]),
    ),
    contact: contactSchema,
    website: z.string().max(100).default(""),
  })
  .strict();
export class ValidationError extends Error {
  constructor(public fields: Record<string, string>) {
    super("Controleer de ingevulde gegevens.");
  }
}
export function prepareSubmission(q: Questionnaire, input: unknown) {
  const p = submissionSchema.parse(input);
  if (p.website) throw new ValidationError({ website: "Aanvraag geweigerd." });
  if (p.version_id !== q.id)
    throw new ValidationError({ version: "Onbekende vragenlijstversie." });
  if (
    Object.keys(p.answers).some((id) => !q.questions.some((x) => x.id === id))
  )
    throw new ValidationError({ answers: "Onbekende vraag." });
  const a = cleanAnswers(q, p.answers);
  const errors = answerErrors(q, a);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  a.postcode = String(a.postcode)
    .replace(/\s/g, "")
    .toUpperCase()
    .replace(/^(.{4})/, "$1 ");
  a.house_number = String(a.house_number).trim();
  const reasons = q.questions.flatMap((question) => {
    const value = a[question.id];
    return question.options
      .filter(
        (o) =>
          o.positive &&
          (Array.isArray(value) ? value.includes(o.id) : value === o.id),
      )
      .map((o) => ({
        question_id: question.id,
        option_id: o.id,
        question: question.label,
        answer: o.label,
      }));
  });
  const snapshots = q.questions
    .filter((x) => visible(x, a, q.questions))
    .map((x) => ({
      question_id: x.id,
      question: x.label,
      value: a[x.id] ?? null,
      answer:
        x.type === "text"
          ? (a[x.id] ?? "")
          : x.options
              .filter((o) =>
                Array.isArray(a[x.id])
                  ? (a[x.id] as string[]).includes(o.id)
                  : a[x.id] === o.id,
              )
              .map((o) => o.label),
    }));
  return {
    ...p,
    answers: a,
    indication: reasons.length ? "possible" : "review_needed",
    reasons,
    snapshots,
  };
}
export const resultText = {
  possible:
    "Je antwoorden bevatten aanwijzingen dat een vergoeding mogelijk is. We controleren je aanvraag en nemen nog contact met je op.",
  review_needed:
    "Op basis van deze korte check kunnen we niet aangeven of een vergoeding mogelijk is. We controleren je aanvraag en nemen nog contact met je op.",
};
