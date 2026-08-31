// Stands in for a real email-delivery integration (e.g. Resend, SendGrid,
// AWS SES) - no such service is configured in this project. Kept isolated
// behind this one function, the same way generate-revision.ts stands in
// for a real model call, so swapping in an actual send later only means
// changing what happens here, not the request/response flow around it. A
// real implementation would also take the edited PDF's bytes to attach.
const SIMULATED_LATENCY_MS = 1500;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature matches the real call this will become
export async function sendPdfEmail(email: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
}
