export async function deliverNotification(
  send: () => Promise<void>,
  attempt: number,
) {
  try {
    await send();
    return { status: "delivered", delivered_at: new Date().toISOString() };
  } catch {
    return {
      status: attempt >= 5 ? "failed" : "pending",
      next_attempt_at: new Date(
        Date.now() + Math.min(3600000, 30000 * 2 ** attempt),
      ).toISOString(),
    };
  }
}
