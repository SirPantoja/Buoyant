# Buoyant

A Next.js + TypeScript app for uploading a PDF file.

## Running locally

**Prerequisites:** [Node.js](https://nodejs.org/) 20 or later and npm.

1. Clone the repository and move into it:
   ```bash
   git clone https://github.com/SirPantoja/Buoyant.git
   cd Buoyant
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser and upload a PDF.

Other useful scripts:

```bash
npm run build   # production build
npm run start   # run the production build locally
npm run lint    # lint the codebase
```

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
