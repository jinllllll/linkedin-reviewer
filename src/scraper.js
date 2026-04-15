const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSIONS_DIR = path.join(__dirname, '..', '.sessions');
const SESSION_FILE = path.join(SESSIONS_DIR, 'linkedin.json');

async function scrapeProfile(profileUrl) {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  const hasSession = fs.existsSync(SESSION_FILE);

  const browser = await chromium.launch({
    headless: hasSession,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = hasSession
    ? await browser.newContext({
        storageState: SESSION_FILE,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      })
    : await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

  const page = await context.newPage();

  // Go to the profile
  await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Detect login wall
  const url = page.url();
  if (
    url.includes('/login') ||
    url.includes('/authwall') ||
    url.includes('/checkpoint')
  ) {
    if (hasSession) {
      // Session expired — wipe it and tell user to re-run
      fs.unlinkSync(SESSION_FILE);
      await browser.close();
      throw new Error(
        'LinkedIn session expired. Run again — a browser window will open for you to log in.'
      );
    }

    console.log('\nLinkedIn login required.');
    console.log('A browser window is open — please log in. This session will be saved.\n');

    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

    // Wait up to 2 minutes for the user to log in and land on feed
    await page.waitForURL(
      (u) => !u.includes('/login') && !u.includes('/authwall') && !u.includes('/checkpoint'),
      { timeout: 120_000 }
    );

    await context.storageState({ path: SESSION_FILE });
    console.log('Session saved. Navigating to profile...\n');

    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  // Scroll to trigger lazy-loaded sections
  await scrollFully(page);

  // Expand all "see more" / "show all" buttons
  await expandAll(page);

  // Extract structured profile data
  const profile = await extractProfile(page, profileUrl);

  // Refresh the saved session on every successful run
  await context.storageState({ path: SESSION_FILE });
  await browser.close();

  return profile;
}

async function scrollFully(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let scrolled = 0;
      const step = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        scrolled += step;
        if (scrolled >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 120);
    });
  });
  await page.waitForTimeout(800);
}

async function expandAll(page) {
  // Expand inline "see more" text blocks and section expanders
  const selectors = [
    'button[aria-label*="more"]',
    'button.inline-show-more-text__button',
    'button[data-control-name="expander_collapse_profile_list"]',
    'span.pvs-list__footer-wrapper button',
  ];
  for (const sel of selectors) {
    const buttons = page.locator(sel);
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      try {
        await buttons.nth(i).click({ timeout: 1500 });
        await page.waitForTimeout(200);
      } catch {
        // Non-fatal — skip buttons that aren't clickable
      }
    }
  }
}

async function extractProfile(page, url) {
  return await page.evaluate((profileUrl) => {
    const text = (el) => el?.textContent?.trim() || null;

    // ── Name & headline ──────────────────────────────────────────────────
    const name = text(document.querySelector('h1'));
    const headline = text(
      document.querySelector('.text-body-medium.break-words')
    );
    const location = text(
      document.querySelector('.text-body-small.inline.t-black--light.break-words')
    );

    // ── About ────────────────────────────────────────────────────────────
    let about = null;
    const aboutAnchor = document.querySelector('#about');
    if (aboutAnchor) {
      const section = aboutAnchor.closest('section');
      about =
        text(section?.querySelector('.inline-show-more-text')) ||
        text(section?.querySelector('[class*="full-width"]')) ||
        text(section?.querySelector('span[aria-hidden="true"]'));
    }

    // ── Generic section extractor ────────────────────────────────────────
    function extractListSection(anchorId) {
      const anchor = document.querySelector(`#${anchorId}`);
      if (!anchor) return [];
      const section = anchor.closest('section');
      if (!section) return [];
      const items = section.querySelectorAll('li.artdeco-list__item');
      return Array.from(items).map((item) => {
        const spans = Array.from(
          item.querySelectorAll('span[aria-hidden="true"]')
        ).map((s) => s.textContent.trim()).filter(Boolean);
        return spans;
      }).filter((s) => s.length > 0);
    }

    // ── Experience ───────────────────────────────────────────────────────
    const rawExp = extractListSection('experience');
    const experience = rawExp.map((spans) => ({
      title: spans[0] || null,
      company: spans[1] || null,
      dateRange: spans[2] || null,
      duration: spans[3] || null,
      description: spans.slice(4).join(' ') || null,
    }));

    // ── Education ────────────────────────────────────────────────────────
    const rawEdu = extractListSection('education');
    const education = rawEdu.map((spans) => ({
      school: spans[0] || null,
      degree: spans[1] || null,
      dateRange: spans[2] || null,
    }));

    // ── Skills ───────────────────────────────────────────────────────────
    const skillAnchor = document.querySelector('#skills');
    const skills = [];
    if (skillAnchor) {
      const section = skillAnchor.closest('section');
      section
        ?.querySelectorAll('.mr1.t-bold span[aria-hidden="true"]')
        ?.forEach((el) => {
          const s = el.textContent.trim();
          if (s) skills.push(s);
        });
    }

    // ── Certifications ───────────────────────────────────────────────────
    const rawCerts = extractListSection('licenses_and_certifications') ||
      extractListSection('certifications');
    const certifications = rawCerts.map((spans) => ({
      name: spans[0] || null,
      issuer: spans[1] || null,
      date: spans[2] || null,
    }));

    // ── Honors & Awards ──────────────────────────────────────────────────
    const rawHonors = extractListSection('honors_and_awards') ||
      extractListSection('awards');
    const honors = rawHonors.map((spans) => ({
      title: spans[0] || null,
      issuer: spans[1] || null,
      date: spans[2] || null,
    }));

    return {
      url: profileUrl,
      extractedAt: new Date().toISOString(),
      name,
      headline,
      location,
      about,
      experience,
      education,
      skills,
      certifications,
      honors,
    };
  }, url);
}

module.exports = { scrapeProfile };
