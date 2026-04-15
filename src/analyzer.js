'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const MODEL = 'claude-opus-4-6'; // most capable for nuanced career analysis

// ── 3 persona prompts ────────────────────────────────────────────────────────

function managerPrompt(snapshot) {
  return `You are a senior industry executive — Director/VP level, 20+ years hiring and leading teams. Direct, commercially minded, allergic to vague accomplishments. Honest but not cruel.

Analyze this LinkedIn profile across 8 dimensions. Reference specific details from the profile.

PROFILE:
${snapshot}

Respond with exactly these 8 headers:

1. FIRST IMPRESSION
2. CAREER VELOCITY
3. IMPACT EVIDENCE
4. LEADERSHIP SIGNALS
5. MARKET POSITIONING
6. RED FLAGS
7. CEILING ASSESSMENT
8. THE ONE HARD TRUTH`;
}

function mentorPrompt(snapshot) {
  return `You are a trusted life mentor — wise, long-horizon thinker. You see the human behind the resume. You balance professional ambition with personal wellbeing equally.

Reflect on this LinkedIn profile. Reference their actual history and choices.

PROFILE:
${snapshot}

Respond with exactly these 7 headers:

1. THE HUMAN STORY
2. PATTERNS ACROSS TIME
3. LIFE-WORK HARMONY
4. HIDDEN STRENGTHS
5. WHAT THE RESUME DOESN'T SAY
6. FULFILLMENT TRAJECTORY
7. WISDOM FOR THE NEXT CHAPTER`;
}

function selfPrompt(snapshot) {
  return `You ARE this person, in a rare moment of complete honesty with yourself. First person. No ego, no defensiveness. You know the difference between a comfort zone and a growth edge.

Reflect on your own career profile below.

PROFILE:
${snapshot}

Respond with exactly these 7 headers (first person throughout):

1. WHAT I'M GENUINELY PROUD OF
2. WHAT I'VE BEEN AVOIDING
3. MY ACTUAL STRENGTHS
4. THE STORY I'VE BEEN TELLING MYSELF
5. WHAT I WOULD DO IF I WEREN'T AFRAID
6. THREE CONCRETE FOCUS AREAS (next 6–12 months)
7. THE QUESTION I KEEP CIRCLING`;
}

// ── Main analysis flow ────────────────────────────────────────────────────────

async function analyzeProfile(profile) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Analyzing: ${profile.name ?? profile.url}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1 — build structured snapshot from raw text
  console.log('Step 1/3  Building profile snapshot...');
  const snapshot = await buildSnapshot(profile.rawText, profile.url);

  // Step 2 — run all 3 lenses in parallel
  console.log('Step 2/3  Running 3-lens analysis in parallel...');
  const [managerView, mentorView, selfView] = await Promise.all([
    callClaude(managerPrompt(snapshot), 'Manager'),
    callClaude(mentorPrompt(snapshot), 'Mentor'),
    callClaude(selfPrompt(snapshot), 'Self'),
  ]);

  // Step 3 — synthesize final report (streaming to terminal)
  console.log('Step 3/3  Synthesizing career report...\n');
  const report = await synthesizeReport(snapshot, managerView, mentorView, selfView, profile.name);

  // Save to file
  const outDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const slug = (profile.name ?? 'report').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const outFile = path.join(outDir, `${slug}-${Date.now()}.md`);
  fs.writeFileSync(outFile, report);
  console.log(`\n\nReport saved → ${outFile}`);
}

async function buildSnapshot(rawText, url) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract a clean, structured career snapshot from this LinkedIn profile text. Include: name, headline, location, about/summary, all experience entries (company, role, dates, key points), education, skills, awards. Be thorough but concise.

URL: ${url}

PROFILE TEXT:
${rawText.slice(0, 12000)}`,
    }],
  });
  return msg.content[0].text;
}

async function callClaude(prompt, label) {
  process.stdout.write(`  [${label}] thinking...`);
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });
  process.stdout.write(` done\n`);
  return msg.content[0].text;
}

async function synthesizeReport(snapshot, managerView, mentorView, selfView, name) {
  const prompt = `You have received three independent analyses of the same career profile from three perspectives:
- An industry veteran manager (critical, commercial)
- A life mentor (holistic, long-horizon)
- The person's own inner voice (honest self-reflection)

Your job: synthesize these into a comprehensive Career Report. Look for where they agree, where they diverge, and what the tension reveals.

PROFILE SNAPSHOT:
${snapshot}

MANAGER'S VIEW:
${managerView}

MENTOR'S VIEW:
${mentorView}

INNER VOICE:
${selfView}

Write the full Career Report in this exact structure:

# Career Report: ${name ?? 'LinkedIn Profile'}
*3-Lens Analysis — Manager · Mentor · Inner Voice*

## Executive Summary
[3–5 sentences. The central picture, the key tension, the one thing to pay attention to.]

## Resume Snapshot
[The structured snapshot]

## Past Wins & Career Highlights
[5–8 bullet points — what mattered and why]

## The Manager's View
${managerView}

## The Mentor's View
${mentorView}

## The Inner Voice
${selfView}

## Current State: Pros & Cons
### Strengths (cross-lens agreement)
### Gaps & Risks (cross-lens agreement)
### Productive Tensions (where lenses disagree — and what that reveals)

## Career Trajectory
[Two paragraphs: where this path leads if nothing changes; where it could lead with 1–2 focused changes]

## Opportunities & Next Steps
[5–7 specific, actionable items ranked by impact. Note which lens surfaced each.]

---
*AI-generated career analysis. Use as a thinking tool, not a verdict.*`;

  // Stream the synthesis to terminal
  let fullText = '';
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      process.stdout.write(chunk.delta.text);
      fullText += chunk.delta.text;
    }
  }

  return fullText;
}

module.exports = { analyzeProfile };
