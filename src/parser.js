'use strict';

const { parse } = require('node-html-parser');

/**
 * Extract visible profile text from LinkedIn page HTML.
 * Works with both the "owner" view (your own profile) and
 * the authenticated visitor view.
 */
function parseProfile(html, url) {
  const root = parse(html);

  // Strip noise
  root.querySelectorAll('script, style, noscript, svg, [aria-hidden="true"]')
    .forEach(el => el.remove());

  const name = root.querySelector('h1')?.text?.trim() ?? null;
  const pageTitle = root.querySelector('title')?.text?.trim() ?? null;

  // Prefer <main>, fall back to <body>
  const main = root.querySelector('main') ?? root.querySelector('body') ?? root;

  const rawText = main.text
    .replace(/\t/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { url, name, pageTitle, rawText };
}

module.exports = { parseProfile };
