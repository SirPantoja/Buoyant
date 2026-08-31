import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// Issues short-lived, scoped client tokens for direct browser-to-Blob
// uploads (see send-pdf-request.ts) - the PDF's actual bytes never pass
// through this route or any other server function, so Vercel's ~4.5 MB
// Serverless Function request-body limit never comes into play for it.
// Uses process.env.BLOB_READ_WRITE_TOKEN implicitly (the @vercel/blob SDK
// reads it automatically when deployed on Vercel).
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["application/pdf"],
        addRandomSuffix: true,
      }),
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    // The @vercel/blob browser SDK always shows a generic "Failed to
    // retrieve the client token" message to the user regardless of what
    // this route returns, so the real reason (e.g. a missing
    // BLOB_READ_WRITE_TOKEN) is only visible here, in the server logs.
    console.error("blob-upload failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed." }, { status: 400 });
  }
}
