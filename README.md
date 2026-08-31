# Buoyant AI Proposal Revising

A Next.js + TypeScript app for uploading a PDF and revising it paragraph by
paragraph with AI.

Link to a live URL: https://buoyant-sigma.vercel.app/

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
### UI matching Buoyant website standards
The buoyant website is very pretty and follows clear UX patterns. I tried my best to match the theming but at a certain point trying to match is not an effective use of time. In a real situation, having a shared UX library would help standardize this process so I did best effort changes to match the UX and scrape the logo. I also think the UX is important, but spending time on features users actually want and will use is higher priority once the UX is good enough.
### Better paragraph parsing (harder pdfs)'
I spent a good amount of time trying to tune when a section became a section and when a section ended. There were many corner cases and at a certain point, due to time and complexity, I landed on heuristic that works most of the time. I think a true solution would leverage existing heuristics (we would need to research) and would need substantive test coverage to ensure stability which is not feasible given time constraints.
### Production user monitoring
An important part of any critical service serving paying customers is reliability and system health monitoring. Any issues in production we need to know ASAP. I wanted to build out some basic logging so that we could get data over time of how often users went through certain flows in the app and how often the app crashed. This was cut because I prioritized features first, this feature doesn't make sense without some initial features.
### Knowledge base integration
I considered integrating this until I saw that the files were quite large. I scoped out the work to being more about parsing the text locally and gathering the relevant details to pass as a primer with the API call. However, I figured this would incur some token costs (I wasn't sure how much budget I had) and would be hard to test extensively without actually making a bunch of API calls for which I was trying to avoid doing until the very end to save budget.
### Multi-paragraph chat
This was mostly cut due to time and complexity. Certainly, I think it would be high user value especially given paragraph parsing flakiness and would have been the next thing to be prioritized.
### User authentication
I wanted to provide a basic login page for the app. For a feature like this, a simple website anyone could access would allow for users who haven't paid to use our tokens so I thought this would be a good feature to add. Due to time constraints and lacking access to Buoyant customer authentication I skipped this.
### Other file type compatibility
Surely our users would have other file types other than PDFs. It would be good to support others. This was cut due to there being so many other files to consider and that other user centric features were more important.
### Whole file checking
I wanted to have a similar feature to multi paragraphs where users can just have the AI review their entire documents in one go. I skipped this because it might be more expensive token-wise and would take some time to fine tune and get right especially without the knowledge base.
### Collaborative Editing
Right now, only one user can edit a document at a time. What if multiple users could collaboratively edit the document in real time? Due to time constraints and overall complexity of real time editing (race conditions and merge conflicts) I cut this.
## Failure modes I worried about
## How I'd evaluate this
## What I added beyond the brief and why
## What I'd build next given another 8 hours
