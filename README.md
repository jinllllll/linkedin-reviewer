# LinkedIn Career Analyzer

AI-powered career report from any LinkedIn profile — three perspectives in parallel: an industry veteran manager, a life mentor, and honest self-reflection.

## How it works

1. **`npm start`** — starts a local server and opens a setup page in your browser
2. **Drag the bookmarklet** to your bookmarks bar (one-time setup)
3. **Go to any LinkedIn profile** while logged in
4. **Click the bookmark** — the analysis streams in your terminal (~30s)

No scraping, no browser automation, no special flags. The bookmarklet captures the page you're already viewing and sends it to your local server.

## Setup

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Install

```bash
git clone https://github.com/jinllllll/linkedin-reviewer.git
cd linkedin-reviewer
npm install
```

### Run

```bash
export ANTHROPIC_API_KEY=sk-ant-...
npm start
```

A browser window opens at `http://localhost:3000`. Follow the 3 steps on that page.

## Testing it yourself

1. Set your API key:
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-...
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. A browser opens automatically. Drag **"Analyze LinkedIn Profile"** to your bookmarks bar.

4. Go to any LinkedIn profile — your own or someone else's (public profiles work too, but logged-in view gives richer data).

5. Click the bookmarklet. You'll see an alert saying "Got it!" — then watch your terminal.

6. The report streams in real time and is saved to `reports/` as a markdown file.

## What you get

```
# Career Report: [Name]
3-Lens Analysis — Manager · Mentor · Inner Voice

## Executive Summary
## Resume Snapshot
## Past Wins & Career Highlights
## The Manager's View       ← industry veteran, critical + commercial
## The Mentor's View        ← holistic, life + career wisdom
## The Inner Voice          ← honest self-reflection, first person
## Current State: Pros & Cons
## Career Trajectory
## Opportunities & Next Steps
```

## Security

- Your LinkedIn session is never stored or transmitted — the bookmarklet captures only the visible HTML of the current page and sends it to `localhost` (your own machine only).
- Your Anthropic API key is read from the environment variable — never hardcoded or logged.
- Generated reports are saved locally to `reports/` which is gitignored.

## License

MIT
