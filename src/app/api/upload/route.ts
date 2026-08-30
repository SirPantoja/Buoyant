import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MIN_EMBEDDED_TEXT_LENGTH = 20;

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
    return NextResponse.json({ error: "File exceeds the 10 MB limit." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });

  let text: string;
  try {
    const result = await parser.getText({ pageJoiner: "" });
    text = result.text.trim();
  } catch (err) {
    console.error("pdf-parse failed", err);
    return NextResponse.json(
      { error: "Could not read this PDF. It may be corrupted or password-protected." },
      { status: 400 },
    );
  } finally {
    await parser.destroy();
  }

  // A PDF with little to no embedded text is likely a scan/image, so it
  // needs OCR instead of the text layer pdf-parse just tried to read.
  if (text.length < MIN_EMBEDDED_TEXT_LENGTH) {
    return NextResponse.json({ name: file.name, size: file.size, source: "ocr-required", text: null });
  }

  return NextResponse.json({ name: file.name, size: file.size, source: "embedded", text });
}
