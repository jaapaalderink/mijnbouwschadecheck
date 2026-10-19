import { db } from "./database.ts";
import { deliverNotification } from "./outbox.ts";
import { mailConfigured, sendMail } from "./mail.ts";

let running = false;
export async function outboxTick() {
  if (
    !db ||
    running ||
    !mailConfigured() ||
    !process.env.NOTIFICATION_EMAIL ||
    !process.env.SITE_URL
  )
    return;
  running = true;
  try {
    const rows = await db.query("select * from claim_notifications()");
    for (const item of rows.rows) {
      const r = await db.query("select number from applications where id=$1", [
        item.application_id,
      ]);
      const outcome = await deliverNotification(async () => {
        if (!r.rowCount) throw Error("NOT_FOUND");
        await sendMail(
          process.env.NOTIFICATION_EMAIL!,
          `Nieuwe aanvraag #${r.rows[0].number}`,
          `Aanvraag #${r.rows[0].number} is ontvangen. Bekijk deze in de beveiligde beheeromgeving: ${process.env.SITE_URL}/admin_sander`,
        );
      }, item.attempts);
      await db.query(
        "update notification_outbox set status=$1,next_attempt_at=coalesce($2::timestamptz,next_attempt_at),delivered_at=$3 where id=$4",
        [
          outcome.status,
          "next_attempt_at" in outcome
            ? new Date(outcome.next_attempt_at!)
            : null,
          "delivered_at" in outcome ? new Date(outcome.delivered_at!) : null,
          item.id,
        ],
      );
    }
  } finally {
    running = false;
  }
}
