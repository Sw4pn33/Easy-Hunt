const axios = require('axios');
const cheerio = require('cheerio');
const { getBrowser } = require('./searchEngine');

const SECURITY_PATHS = [
  '/security', '/security.txt', '/.well-known/security.txt',
  '/responsible-disclosure', '/vulnerability-disclosure',
  '/bug-bounty', '/security-policy', '/disclosure',
  '/report-vulnerability', '/security/policy',
  '/trust/security', '/about/security',
];

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const SECURITY_EMAIL_KEYWORDS = ['security', 'abuse', 'cert', 'vuln', 'disclosure', 'bug', 'infosec', 'soc', 'incident', 'report'];

const SECURITY_PAGE_KEYWORDS = [
  'vulnerability', 'disclosure', 'security', 'bounty', 'report',
  'responsible', 'coordinated', 'bug', 'reward', 'researcher',
  'hall of fame', 'acknowledgement', 'cvd', 'vdp', 'scope',
  'eligible', 'severity', 'critical', 'remediation', 'pgp',
  'encrypt', 'safe harbor', 'good faith',
];

function cleanEmail(raw) {
  if (!raw) return null;
  let email = raw.trim()
    .replace(/^mailto:/i, '')
    .replace(/^<|>$/g, '')
    .split('?')[0]
    .split('#')[0]
    .trim()
    .toLowerCase();
  if (/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return email;
  }
  return null;
}

function isJunkEmail(email) {
  if (!email) return true;

  const junk = ['example.com', 'sentry.io', 'wixpress.com', 'w3.org', 'schema.org',
    'yourcompany.com', 'company.com', 'email.com', 'domain.com', 'test.com',
    'placeholder.com', 'sample.com', 'noreply', 'no-reply', 'donotreply',
    '.png', '.jpg', '.gif', '.svg', '.css', '.js', 'webpack', 'cloudflare',
    'localhost', 'invalid', 'none.com', 'null.com', 'fake.com', 'temp.com'];
  if (junk.some(j => email.includes(j))) return true;

  const domain = email.split('@')[1];
  if (!domain) return true;

  const parts = domain.split('.');
  const tld = parts[parts.length - 1];

  if (tld.length < 2 || tld.length > 12) return true;

  if (tld.length <= 3) {
    const validShortTLDs = new Set([
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'us', 'uk',
      'ca', 'au', 'de', 'fr', 'jp', 'cn', 'in', 'br', 'ru', 'za', 'nl', 'se',
      'no', 'fi', 'dk', 'ch', 'at', 'be', 'es', 'it', 'pt', 'pl', 'cz', 'hu',
      'ro', 'bg', 'hr', 'sk', 'si', 'lt', 'lv', 'ee', 'ie', 'lu', 'mt', 'cy',
      'gr', 'tr', 'il', 'ae', 'sg', 'hk', 'tw', 'kr', 'th', 'my', 'ph', 'vn',
      'id', 'pk', 'bd', 'np', 'lk', 'nz', 'mx', 'ar', 'cl', 'pe', 'ke', 'ng',
      'gh', 'eg', 'ma', 'tz', 'ug', 'me', 'tv', 'cc', 'biz', 'ai', 'ml', 'gg',
      'ly', 'is', 'to', 'fm', 'am', 'pm', 'ac', 'do', 'eu', 'ua', 'uz', 'kz',
      'ge', 'by', 'rs', 'ba', 'mk', 'al', 'md', 'mn', 'la', 'mm', 'kg', 'tj',
    ]);
    if (!validShortTLDs.has(tld)) return true;
  }

  const domainName = parts.slice(0, -1).join('.');
  if (domainName.length < 2) return true;

  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(domainName.replace(/\./g, ''))) return true;

  return false;
}

async function analyzePageInBrowser(pageUrl, extractPage) {
  try {
    const resp = await extractPage.goto(pageUrl, {
      waitUntil: 'domcontentloaded', timeout: 12000
    });
    if (!resp || (resp.status() !== 200 && resp.status() !== 301 && resp.status() !== 302)) return null;

    await new Promise(r => setTimeout(r, 800));

    await extractPage.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 300));
      window.scrollTo(0, 0);
    });

    const pageData = await extractPage.evaluate((secKeywords, emailKeywords) => {
      const text = (document.body.innerText || '').toLowerCase();
      const html = document.body.innerHTML || '';
      const title = document.title || '';
      const url = window.location.href;

      const keywordMatches = secKeywords.filter(k => text.includes(k));
      const isSecurityPage = keywordMatches.length >= 2;

      const urlLower = url.toLowerCase();
      const titleLower = title.toLowerCase();
      const urlHints = ['security', 'disclosure', 'vulnerability', 'bounty', 'report', 'bug'];
      const hasUrlHint = urlHints.some(h => urlLower.includes(h) || titleLower.includes(h));

      if (!isSecurityPage && !hasUrlHint) return null;

      const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
      const rawEmails = [...new Set(html.match(emailRegex) || [])];

      const mailtoEmails = [];
      document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
        const href = el.getAttribute('href') || '';
        const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
        if (email.includes('@')) mailtoEmails.push(email);
      });

      const forms = [];
      document.querySelectorAll('form').forEach(form => {
        const action = form.getAttribute('action') || '';
        if (action && !action.includes('search') && !action.includes('login')) {
          forms.push({ type: 'form', url: action });
        }
      });
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const linkText = (a.innerText || '').toLowerCase();
        if (href.includes('hackerone.com/') || href.includes('bugcrowd.com/') ||
            href.includes('intigriti.com/') || href.includes('yeswehack.com/')) {
          forms.push({ type: 'platform', url: href, text: linkText });
        }
        if (linkText.includes('submit') || linkText.includes('report') || linkText.includes('contact')) {
          if (href.startsWith('http') && !href.includes('mailto:')) {
            forms.push({ type: 'link', url: href, text: linkText });
          }
        }
      });

      let programType = 'unknown';
      if (text.includes('bounty') || text.includes('reward') || text.includes('monetary') ||
          text.includes('payout') || text.includes('compensation')) {
        programType = 'bounty';
      } else if (text.includes('swag') || text.includes('t-shirt') || text.includes('merchandise') ||
                 text.includes('goodies')) {
        programType = 'swag';
      } else if (text.includes('hall of fame') || text.includes('acknowledgement') ||
                 text.includes('wall of fame') || text.includes('thank')) {
        programType = 'hof';
      } else if (text.includes('disclosure') || text.includes('report') || text.includes('responsible')) {
        programType = 'vdp';
      }

      let scope = null;
      const scopePatterns = ['in scope', 'out of scope', 'eligible', 'not eligible', 'target'];
      if (scopePatterns.some(p => text.includes(p))) {
        const scopeHeaders = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        scopeHeaders.forEach(h => {
          const hText = h.innerText.toLowerCase();
          if (hText.includes('scope') || hText.includes('eligible') || hText.includes('target')) {
            const nextSibling = h.nextElementSibling;
            if (nextSibling) {
              scope = nextSibling.innerText.substring(0, 500);
            }
          }
        });
      }

      let confidence = 0;
      if (keywordMatches.length >= 4) confidence += 40;
      else if (keywordMatches.length >= 2) confidence += 20;
      if (hasUrlHint) confidence += 20;
      if (rawEmails.length > 0 || mailtoEmails.length > 0) confidence += 15;
      if (forms.length > 0) confidence += 15;
      if (programType !== 'unknown') confidence += 10;

      return {
        isSecurityPage: true,
        url,
        title,
        emails: [...rawEmails, ...mailtoEmails],
        forms,
        programType,
        scope,
        confidence,
        keywordMatches: keywordMatches.length,
      };
    }, SECURITY_PAGE_KEYWORDS, SECURITY_EMAIL_KEYWORDS);

    return pageData;
  } catch (e) {
    return null;
  }
}

async function analyzePageWithAxios(pageUrl) {
  try {
    const resp = await axios.get(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000, maxRedirects: 3, validateStatus: s => s === 200,
    });
    if (!resp.data || typeof resp.data !== 'string') return null;

    const $ = cheerio.load(resp.data);
    const text = $('body').text().toLowerCase();
    const html = resp.data;

    const keywordMatches = SECURITY_PAGE_KEYWORDS.filter(k => text.includes(k));
    const urlLower = pageUrl.toLowerCase();
    const urlHints = ['security', 'disclosure', 'vulnerability', 'bounty', 'report', 'bug'];
    const hasUrlHint = urlHints.some(h => urlLower.includes(h));

    if (keywordMatches.length < 2 && !hasUrlHint) return null;

    const rawEmails = html.match(EMAIL_REGEX) || [];
    const mailtoEmails = [];
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (email.includes('@')) mailtoEmails.push(email);
    });

    const forms = [];
    $('a[href*="hackerone"], a[href*="bugcrowd"], a[href*="intigriti"]').each((_, el) => {
      forms.push({ type: 'platform', url: $(el).attr('href') });
    });

    let programType = 'unknown';
    if (text.includes('bounty') || text.includes('reward')) programType = 'bounty';
    else if (text.includes('swag') || text.includes('t-shirt')) programType = 'swag';
    else if (text.includes('hall of fame')) programType = 'hof';
    else if (text.includes('disclosure')) programType = 'vdp';

    return {
      isSecurityPage: true,
      url: pageUrl,
      emails: [...rawEmails, ...mailtoEmails],
      forms,
      programType,
      confidence: keywordMatches.length * 10 + (hasUrlHint ? 20 : 0),
    };
  } catch (e) {
    return null;
  }
}

async function extractSecurityInfo(domain, googleUrl) {
  const browser = getBrowser();
  const useBrowser = browser && browser.isConnected();
  let extractPage = null;

  const result = {
    domain,
    googleUrl: googleUrl || null,
    securityPage: null,
    securityEmails: [],
    allEmails: [],
    hasSecurityTxt: false,
    submissionForm: null,
    programType: 'unknown',
    confidence: 0,
    scope: null,
  };

  try {
    if (useBrowser) {
      extractPage = await browser.newPage();
      await extractPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    }

    const baseUrl = `https://${domain}`;

    if (googleUrl && googleUrl.startsWith('http')) {
      const analysis = useBrowser
        ? await analyzePageInBrowser(googleUrl, extractPage)
        : await analyzePageWithAxios(googleUrl);

      if (analysis && analysis.isSecurityPage) {
        result.securityPage = analysis.url || googleUrl;
        result.programType = analysis.programType;
        result.confidence = analysis.confidence;
        if (analysis.scope) result.scope = analysis.scope;

        const allCleaned = (analysis.emails || []).map(cleanEmail).filter(e => e && !isJunkEmail(e));
        result.allEmails = [...new Set(allCleaned)];
        result.securityEmails = result.allEmails.filter(e =>
          SECURITY_EMAIL_KEYWORDS.some(k => e.includes(k))
        );
        if (result.securityEmails.length === 0 && result.allEmails.length > 0) {
          result.securityEmails = result.allEmails.slice(0, 3);
        }

        if (analysis.forms && analysis.forms.length > 0) {
          const platformForm = analysis.forms.find(f => f.type === 'platform');
          const regularForm = analysis.forms.find(f => f.type === 'form' || f.type === 'link');
          result.submissionForm = platformForm?.url || regularForm?.url || null;
        }

        if (result.confidence >= 30) {
          await checkSecurityTxt(baseUrl, result, useBrowser ? extractPage : null);
          if (extractPage) try { await extractPage.close(); } catch (e) {}
          return result;
        }
      }
    }

    await checkSecurityTxt(baseUrl, result, useBrowser ? extractPage : null);

    if (!result.securityPage || result.confidence < 20) {
      for (const path of SECURITY_PATHS) {
        if (result.securityPage && !result.securityPage.includes('security.txt') && result.confidence >= 20) break;
        if (googleUrl && googleUrl.includes(path)) continue;

        const testUrl = `${baseUrl}${path}`;
        const analysis = useBrowser
          ? await analyzePageInBrowser(testUrl, extractPage)
          : await analyzePageWithAxios(testUrl);

        if (analysis && analysis.isSecurityPage) {
          if (analysis.confidence > result.confidence) {
            result.securityPage = analysis.url || testUrl;
            result.programType = analysis.programType;
            result.confidence = analysis.confidence;

            const allCleaned = (analysis.emails || []).map(cleanEmail).filter(e => e && !isJunkEmail(e));
            result.allEmails = [...new Set([...result.allEmails, ...allCleaned])];
            result.securityEmails = [
              ...new Set([
                ...result.securityEmails,
                ...allCleaned.filter(e => SECURITY_EMAIL_KEYWORDS.some(k => e.includes(k))),
              ]),
            ];
            if (result.securityEmails.length === 0 && result.allEmails.length > 0) {
              result.securityEmails = result.allEmails.slice(0, 3);
            }
            if (analysis.forms && analysis.forms.length > 0 && !result.submissionForm) {
              const platformForm = analysis.forms.find(f => f.type === 'platform');
              result.submissionForm = platformForm?.url || analysis.forms[0]?.url || null;
            }
          }
          break;
        }
      }
    }

    result.securityEmails = [...new Set(result.securityEmails)];
    result.allEmails = [...new Set(result.allEmails)];

    if (extractPage) try { await extractPage.close(); } catch (e) {}
    return result;

  } catch (err) {
    console.error(`Extraction error for ${domain}:`, err.message);
    if (extractPage) try { await extractPage.close(); } catch (e) {}
    return result;
  }
}

async function checkSecurityTxt(baseUrl, result, extractPage) {
  for (const txtPath of ['/.well-known/security.txt', '/security.txt']) {
    try {
      let text = null;
      let status = 0;

      if (extractPage) {
        const resp = await extractPage.goto(`${baseUrl}${txtPath}`, {
          waitUntil: 'domcontentloaded', timeout: 8000
        });
        status = resp ? resp.status() : 0;
        if (status === 200) {
          text = await extractPage.evaluate(() => document.body.innerText || '');
        }
      } else {
        const resp = await axios.get(`${baseUrl}${txtPath}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000, maxRedirects: 3, validateStatus: s => s === 200,
        });
        status = resp.status;
        text = resp.data;
      }

      if (status === 200 && text && typeof text === 'string' && text.includes('Contact:')) {
        result.hasSecurityTxt = true;
        if (!result.securityPage) result.securityPage = `${baseUrl}${txtPath}`;

        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('Contact:')) {
            const contact = trimmed.replace('Contact:', '').trim();
            const cleaned = cleanEmail(contact);
            if (cleaned && !isJunkEmail(cleaned)) {
              if (!result.securityEmails.includes(cleaned)) {
                result.securityEmails.push(cleaned);
              }
            } else if (contact.startsWith('http') && !result.submissionForm) {
              result.submissionForm = contact;
            }
          }
        }
        result.confidence = Math.max(result.confidence, 25);
        break;
      }
    } catch (e) {}
  }
}

async function batchExtract(domains, concurrency = 3, onProgress, resultsList, session) {
  const results = [];
  let completed = 0;

  const browser = getBrowser();
  const actualConcurrency = (browser && browser.isConnected()) ? 2 : concurrency;

  const urlMap = new Map();
  if (resultsList && Array.isArray(resultsList)) {
    for (const r of resultsList) {
      if (r.domain && r.url) {
        urlMap.set(r.domain, r.url);
      }
    }
  }

  for (let i = 0; i < domains.length; i += actualConcurrency) {
    if (session && session.status === 'stopped') {
      if (browser && browser.isConnected()) {
        try {
          const pages = await browser.pages();
          for (let p = pages.length - 1; p > 0; p--) {
            try { await pages[p].close(); } catch (e) {}
          }
        } catch (e) {}
      }
      break;
    }

    const batch = domains.slice(i, i + actualConcurrency);
    const batchResults = await Promise.allSettled(
      batch.map(d => extractSecurityInfo(d, urlMap.get(d) || null))
    );

    for (let j = 0; j < batchResults.length; j++) {
      completed++;
      const r = batchResults[j];
      if (r.status === 'fulfilled') {
        results.push(r.value);
      } else {
        results.push({ domain: batch[j], error: r.reason?.message });
      }
      if (onProgress) onProgress(completed, domains.length);
    }

    if (i + actualConcurrency < domains.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return results;
}

module.exports = { extractSecurityInfo, batchExtract };
