# Buoyant

A Next.js + TypeScript app for uploading a PDF file.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload a PDF.

## How it works

- `src/app/page.tsx` renders a file picker restricted to PDFs and posts the
  selected file to `/api/upload`.
- `src/app/api/upload/route.ts` validates the upload (must be a PDF, up to
  10 MB) and responds with the file's name and size.

## Deployment

This app is set up to deploy on [Vercel](https://vercel.com/new). Push the
repository to GitHub and import it in Vercel, or run:

```bash
npx vercel
```
