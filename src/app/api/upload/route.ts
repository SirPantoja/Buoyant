import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/extract-pdf-text";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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
    return NextResponse.json({ error: "File exceeds the 50 MB limit." }, { status: 400 });
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
