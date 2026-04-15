#!/usr/bin/env node
'use strict';

const { scrapeProfile } = require('./scraper');

async function main() {
  const url = process.argv[2];

  if (!url || !url.includes('linkedin.com/in/')) {
    console.error('Usage: node src/index.js <linkedin-profile-url>');
    console.error('Example: node src/index.js https://www.linkedin.com/in/someone/');
    process.exit(1);
  }

  console.log(`Fetching LinkedIn profile: ${url}\n`);

  try {
    const profile = await scrapeProfile(url);

    if (!profile.name) {
      console.error('Could not extract profile data — the page may have changed structure.');
      process.exit(1);
    }

    console.log(JSON.stringify(profile, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
