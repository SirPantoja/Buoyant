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
There are some constraints put on by the frameworks we are using on file size. PDFs that are really large might give us memory issues or even just issues in transporting from the users computer. In fact, I ran into some of these with the test files given because of limits in Vercel but this was fixed by manually upping the max (though there is still a max). Another issue is failures in calling the model APIs (we cannot always assume the APIs will be successful, their servers could go down, we run out of tokens) and using the Resend APIs. For these things, I would have production monitoring and substantive integration tests. I would always test API failures cases and handle them gracefully that inform the user that we are having problems in a UX friendly way (ie Open AI is not responding to our calls, please be patient).
## How I'd evaluate this
## What I added beyond the brief and why
### Undo Behavior & Retries
The specs said try undo if possible and so I tried to make it possible by designing it so that each paragraph had a list of edits that were applied sequentially. This made popping out the last one very easy. I did this because as a user undo would be critical if the AI hallucinated. I also added convenient retry and retry with edits buttons because of the non deterministic behaviors of AI and so this would make a huge difference to users.
### Emailing the PDFs
The whole point of this product was so that firms could easier edit their PDF proposals. How annoying would it be if they had to figure out a way to get their edits out of our app. I thought this was an essential feature for user ease and it had an added bonus of being fun to learn about the emailing solution space. From a user perspective, it is nice to have it be an all in one product where they can even email the finished product to where it needs to go!
### UX Improvements
I made an effort to look at the existing Buoyant website and tried my best to match the color scheme and logos. From a user perspective, a matching UX signals product cohesiveness and also perception of safety and quality. I prioritized this to that end!
## What I'd build next given another 8 hours
### User Authentication Layer/Integration
I would integrate with Buoyant's customer credentials to have a login page so that existing users can use the feature and non users cannot.
### Production Monitoring
I would build a basic system health monitoring tool that would capture production data over time and put it into a dashboard to ensure we are providing our users with the optimal experience and so we can observe trends in our product usage.
### Improve the Paragraph Parsing Algorithms
I would research the solution space of PDF parsing and look for free libraries I could potentially integrate with or build my own. I would add robust test cases to verify either one and make sure we provide the best user experience (no weird paragraph cuts).
### Knowledge Base Integration
I would fine tune our AI usage by building a repository both for specific clients and general usage so that we have a tailored experience for each user of the app.
### Robust UX Library
I would build a robust UX library that keep all of our web apps to a particular standard and speed up the process of UX polishing.
### Other cuts
I would also prioritize all the other cuts I discussed above as follow ups.

