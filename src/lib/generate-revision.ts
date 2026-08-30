// Stands in for a real AI call. Kept isolated behind this one function so
// swapping in an actual model later only means changing what happens here,
// not the request/response flow around it.
export const DUMMY_AI_RESPONSE = "this is an ai edit";

const SIMULATED_LATENCY_MS = 2000;

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature matches the real call this will become
export async function generateRevision(currentText: string, instructions: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
  return DUMMY_AI_RESPONSE;
}
