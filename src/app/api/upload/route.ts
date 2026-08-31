import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/extract-pdf-text";

// Vercel's Serverless Functions reject any request body over ~4.5 MB at
// the platform level, before it ever reaches this handler - and that
// rejection isn't a JSON response, so the client's `response.json()`
// throws "Unexpected end of JSON input" instead of getting a clean error
// message. Enforcing a limit comfortably under that here means a
// too-large file gets our own friendly error instead.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was provided." }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File exceeds the 4 MB limit." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let result: Awaited<ReturnType<typeof extractPdfText>>;
  try {
    result = await extractPdfText(buffer);
  } catch (err) {
    console.error("pdf-parse failed", err);
    return NextResponse.json(
      { error: "Could not read this PDF. It may be corrupted or password-protected." },
      { status: 400 },
    );
  }

  return NextResponse.json({ name: file.name, size: file.size, ...result });
}
