'use strict';

const express = require('express');
const { parseProfile } = require('./parser');
const { analyzeProfile } = require('./analyzer');

const PORT = process.env.PORT || 3000;

// Bookmarklet — grabs page HTML and POSTs to local server
// Written as a self-contained IIFE that works in any browser
const BOOKMARKLET = `javascript:(function(){
  var d={url:location.href,title:document.title,html:document.documentElement.outerHTML};
  fetch('http://localhost:${PORT}/analyze',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(d)
  }).then(function(r){
    if(r.ok){alert('Got it! Analysis is running in your terminal.');}
    else{alert('Server error. Check your terminal.');}
  }).catch(function(){
    alert('Cannot reach the server.\\nMake sure \\"npm start\\" is still running.');
  });
})();`.replace(/\n/g, '');

function startServer() {
  const app = express();

  // Allow large LinkedIn pages (can be 1–2 MB of HTML)
  app.use(express.json({ limit: '10mb' }));

  // CORS — bookmarklet makes cross-origin request from linkedin.com
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // ── Setup page ─────────────────────────────────────────────────────────
  app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LinkedIn Career Analyzer</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8f9fa;color:#1a1a1a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border-radius:12px;padding:40px;max-width:520px;width:100%;box-shadow:0 2px 16px rgba(0,0,0,.08)}
    h1{font-size:1.4rem;font-weight:700;margin-bottom:6px}
    .sub{color:#666;font-size:.9rem;margin-bottom:32px}
    .step{display:flex;gap:14px;margin-bottom:24px;align-items:flex-start}
    .num{background:#0077b5;color:#fff;border-radius:50%;width:28px;height:28px;min-width:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem}
    .step p{font-size:.95rem;padding-top:4px}
    .step p b{display:block;margin-bottom:4px}
    .btn{display:inline-block;padding:11px 22px;background:#0077b5;color:#fff;border-radius:7px;text-decoration:none;font-weight:600;font-size:.95rem;cursor:grab;user-select:none;border:none}
    .btn:active{cursor:grabbing}
    .note{margin-top:28px;padding:12px 16px;background:#f0f7ff;border-left:3px solid #0077b5;border-radius:0 6px 6px 0;font-size:.85rem;color:#444}
    .ready{display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:50%;margin-right:6px}
  </style>
</head>
<body>
  <div class="card">
    <h1>LinkedIn Career Analyzer</h1>
    <p class="sub">3-lens AI career report — Manager · Mentor · Inner Voice</p>

    <div class="step">
      <div class="num">1</div>
      <p><b>Drag this to your bookmarks bar</b>
        <a class="btn" href="${BOOKMARKLET}">Analyze LinkedIn Profile</a>
      </p>
    </div>

    <div class="step">
      <div class="num">2</div>
      <p><b>Go to any LinkedIn profile</b><br>
        Make sure you're logged in — the full profile must be visible.
      </p>
    </div>

    <div class="step">
      <div class="num">3</div>
      <p><b>Click the bookmark</b><br>
        The analysis will stream in this terminal. Takes ~30 seconds.
      </p>
    </div>

    <div class="note">
      <span class="ready"></span>Server is running on port ${PORT}. Keep this terminal open.
    </div>
  </div>
</body>
</html>`);
  });

  // ── Analyze endpoint ────────────────────────────────────────────────────
  app.post('/analyze', async (req, res) => {
    const { url, title, html } = req.body ?? {};

    if (!html || !url) {
      return res.status(400).json({ error: 'Missing url or html' });
    }

    if (!url.includes('linkedin.com')) {
      return res.status(400).json({ error: 'Not a LinkedIn URL' });
    }

    // Respond immediately so the bookmarklet alert shows right away
    res.json({ status: 'ok', message: 'Analysis running — check your terminal' });

    // Run analysis async (streams to terminal)
    const profile = parseProfile(html, url);
    analyzeProfile(profile).catch(err => {
      console.error('\nAnalysis failed:', err.message);
      if (err.message.includes('API key') || err.status === 401) {
        console.error('Set your API key:  export ANTHROPIC_API_KEY=sk-ant-...');
      }
    });
  });

  // ── Start ───────────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.clear();
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║        LinkedIn Career Analyzer  —  Ready             ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  → Open http://localhost:${PORT}  in your browser`);
    console.log('  → Drag the bookmarklet to your bookmarks bar');
    console.log('  → Navigate to a LinkedIn profile and click it');
    console.log('');
    console.log('  Waiting for profiles...');
    console.log('');

    // Auto-open setup page
    const open = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    require('child_process').exec(`${open} http://localhost:${PORT}`);
  });
}

module.exports = { startServer };
