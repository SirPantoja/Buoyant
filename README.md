# Buoyant AI Proposal Revising

A Next.js + TypeScript app for uploading a PDF and revising it paragraph by
paragraph with AI.

## Setup & run instructions

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
4. Open [http://localhost:3000](http://localhost:3000) in your browser and upload a PDF. Note we need to set the following environment variables for it to work locally: RESEND_API_KEY, BLOB_READ_WRITE_TOKEN, ANTHROPIC_API_KEY. The first two are to enable email sending and the last is to make an AI API request.

Other useful scripts:

```bash
npm run build   # production build
npm run start   # run the production build locally
npm run lint    # lint the codebase
npm test        # run the test suite
```

## Design Decisions
## What I cut and why
## Failure modes I worried about
## How I'd evaluate this
## What I added beyond the brief and why
## What I'd build next given another 8 hours
