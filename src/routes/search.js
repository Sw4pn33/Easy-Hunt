const express = require('express');
const router = express.Router();
const { launchBrowser, closeBrowser, checkReady, multiSearch, getBrowserStatus } = require('../utils/searchEngine');
const { batchExtract } = require('../utils/extractor');
const { DORK_TEMPLATES } = require('../dorks');

const sessions = new Map();

router.get('/dorks', (req, res) => {
  res.json({ success: true, dorks: DORK_TEMPLATES });
});

router.post('/launch-browser', async (req, res) => {
  try {
    const result = await launchBrowser();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: `Failed to launch browser: ${err.message}` });
  }
});

router.get('/browser-status', async (req, res) => {
  try {
    const status = getBrowserStatus();
    if (!status.launched) return res.json({ launched: false, ready: false, message: 'Browser not launched' });
    const ready = await checkReady();
    res.json({ ...status, ...ready });
  } catch (err) {
    res.json({ launched: false, ready: false, message: err.message });
  }
});

router.post('/close-browser', async (req, res) => {
  await closeBrowser();
  res.json({ success: true });
});

router.post('/start', async (req, res) => {
  const { dorks, maxResults = 50, mode = 'total' } = req.body;

  if (!dorks || !Array.isArray(dorks) || dorks.length === 0) {
    return res.status(400).json({ error: 'Provide at least one dork query' });
  }

  const status = getBrowserStatus();
  if (!status.launched) {
    return res.status(400).json({ error: 'Launch browser first (click the Browser button)' });
  }

  const max = Math.min(Math.max(parseInt(maxResults) || 50, 10), 500);
  const isPerDork = mode === 'perDork';
  const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

  sessions.set(sessionId, {
    status: 'searching',
    progress: 0,
    total: dorks.length,
    results: [],
    liveResults: [],
    phase: 'dorking',
    currentDork: '',
    startedAt: Date.now(),
    captchaWaiting: false,
    mode: isPerDork ? 'perDork' : 'total',
  });

  res.json({ success: true, sessionId });

  (async () => {
    const session = sessions.get(sessionId);
    const allResults = [];
    const seen = new Set();

    const perDork = isPerDork ? max : Math.max(Math.ceil(max / dorks.length), 10);

    for (let i = 0; i < dorks.length; i++) {
      if (!sessions.has(sessionId) || session.status === 'stopped') break;
      session.progress = i + 1;
      session.phase = 'dorking';
      session.currentDork = dorks[i];

      try {
        await multiSearch(dorks[i], perDork, (r) => {
          if (!seen.has(r.domain)) {
            seen.add(r.domain);
            r.dorkUsed = dorks[i];
            allResults.push(r);
            session.liveResults = [...allResults];
          }
        });
      } catch (err) {
        console.error(`Dork error [${i}]:`, err.message);
        if (err.message.includes('CAPTCHA')) {
          session.captchaWaiting = true;
        }
      }

      if (!isPerDork && allResults.length >= max) break;

      if (i < dorks.length - 1) {
        await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
      }
    }

    if (session.status === 'stopped') {
      session.results = allResults;
      session.phase = 'done';
      session.completedAt = Date.now();
      setTimeout(() => sessions.delete(sessionId), 30 * 60 * 1000);
      return;
    }

    session.results = allResults;

    if (allResults.length > 0 && session.status !== 'stopped') {
      session.phase = 'extracting';
      session.progress = 0;
      session.total = allResults.length;

      const domains = allResults.map(r => r.domain);
      const extracted = await batchExtract(domains, 3, (done, total) => {
        session.progress = done;
        session.total = total;
      }, allResults, session);

      for (let i = 0; i < allResults.length; i++) {
        const ext = extracted.find(e => e.domain === allResults[i].domain);
        if (ext) {
          allResults[i].securityPage = ext.securityPage;
          allResults[i].securityEmails = ext.securityEmails;
          allResults[i].allEmails = ext.allEmails;
          allResults[i].hasSecurityTxt = ext.hasSecurityTxt;
          allResults[i].programType = ext.programType;
          allResults[i].submissionForm = ext.submissionForm;
          allResults[i].confidence = ext.confidence || 0;
          allResults[i].scope = ext.scope || null;
        }
      }
    }

    session.results = allResults;
    if (session.status !== 'stopped') {
      session.status = 'completed';
    }
    session.phase = 'done';
    session.completedAt = Date.now();

    setTimeout(() => sessions.delete(sessionId), 30 * 60 * 1000);
  })();
});

router.get('/progress/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.json({
    status: session.status,
    phase: session.phase,
    progress: session.progress,
    total: session.total,
    currentDork: session.currentDork || '',
    resultsCount: session.results.length > 0 ? session.results.length : session.liveResults.length,
    results: session.results.length > 0 ? session.results : session.liveResults,
    mode: session.mode || 'total',
    elapsed: Date.now() - session.startedAt,
    captchaWaiting: session.captchaWaiting || false,
  });
});

router.post('/stop/:sessionId', (req, res) => {
  if (sessions.has(req.params.sessionId)) {
    const session = sessions.get(req.params.sessionId);
    session.status = 'stopped';
    if (session.results.length === 0 && session.liveResults.length > 0) {
      session.results = [...session.liveResults];
    }
    session.phase = 'done';
    session.completedAt = Date.now();
    res.json({ success: true, savedResults: session.results.length });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

router.get('/export/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const rows = [['Domain', 'URL', 'Title', 'Security Page', 'Security Emails', 'Program Type', 'Has security.txt', 'Submission Form', 'Source', 'Dork Used']];

  for (const r of session.results) {
    rows.push([
      r.domain || '', r.url || '', (r.title || '').replace(/"/g, '""'),
      r.securityPage || '', (r.securityEmails || []).join('; '),
      r.programType || '', r.hasSecurityTxt ? 'Yes' : 'No',
      r.submissionForm || '', r.source || '', (r.dorkUsed || '').replace(/"/g, '""'),
    ]);
  }

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=easyhunt-results-${Date.now()}.csv`);
  res.send(csv);
});

module.exports = router;
