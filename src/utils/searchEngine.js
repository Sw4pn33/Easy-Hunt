const puppeteer = require('puppeteer');

let browser = null;
let page = null;
let isReady = false;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const EXCLUDED_DOMAINS = new Set([
  'hackerone.com', 'bugcrowd.com', 'synack.com', 'intigriti.com',
  'yeswehack.com', 'yogosha.com', 'federacy.com', 'cobalt.io',
  'huntr.dev', 'openbugbounty.org', 'immunefi.com', 'code4rena.com',
  'hackenproof.com', 'inspectiv.com', 'safehats.com',
  'meta.com', 'facebook.com', 'google.com', 'microsoft.com',
  'apple.com', 'amazon.com', 'netflix.com', 'twitter.com', 'x.com',
  'github.com', 'gitlab.com', 'linkedin.com', 'instagram.com',
  'tiktok.com', 'snapchat.com', 'uber.com', 'airbnb.com',
  'paypal.com', 'stripe.com', 'spotify.com', 'dropbox.com',
  'salesforce.com', 'oracle.com', 'ibm.com', 'intel.com',
  'samsung.com', 'sony.com', 'adobe.com', 'vmware.com',
  'medium.com', 'wikipedia.org', 'reddit.com', 'quora.com',
  'stackoverflow.com', 'youtube.com', 'vimeo.com',
  'docs.bugcrowd.com', 'docs.hackerone.com',
  'blog.hackerone.com', 'blog.bugcrowd.com',
  'responsibledisclosure.com', 'disclose.io',
]);

async function getActivePage() {
  if (!browser) return null;
  const pages = await browser.pages();
  for (const p of pages) {
    if (p.url() === 'about:blank' && pages.length > 1) {
      try { await p.close(); } catch (e) {}
    }
  }
  const remaining = await browser.pages();
  return remaining[remaining.length - 1];
}

async function launchBrowser() {
  if (browser) {
    try { await browser.close(); } catch (e) {}
  }

  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900',
    ],
  });

  const defaultPages = await browser.pages();
  page = defaultPages[0];

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    window.chrome = { runtime: {} };
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 30000 });

  try {
    const consentBtn = await page.$('button#L2AGLb, [aria-label="Accept all"], button[id="W0wltc"]');
    if (consentBtn) { await consentBtn.click(); await sleep(1000); }
  } catch (e) {}

  isReady = true;
  return { success: true, message: 'Browser launched. Solve CAPTCHA if shown, then start searching.' };
}

async function checkReady() {
  if (!browser || !browser.isConnected()) {
    browser = null; page = null; isReady = false;
    return { ready: false, message: 'Browser not launched' };
  }
  if (!page) return { ready: false, message: 'Browser not launched' };
  try {
    page = await getActivePage();
    const hasCaptcha = await page.evaluate(() => {
      return !!(document.querySelector('#captcha-form') ||
               document.querySelector('.g-recaptcha') ||
               document.querySelector('#recaptcha') ||
               document.body.innerText.includes('unusual traffic'));
    });
    if (hasCaptcha) return { ready: false, message: 'CAPTCHA detected — please solve it in the browser window' };
    return { ready: true, message: 'Ready to search' };
  } catch (e) {
    return { ready: false, message: e.message };
  }
}

function isExcludedDomain(domain) {
  if (!domain) return true;
  const d = domain.toLowerCase().replace(/^www\./, '');
  if (EXCLUDED_DOMAINS.has(d)) return true;
  for (const ex of EXCLUDED_DOMAINS) {
    if (d.endsWith('.' + ex)) return true;
  }
  return false;
}

async function detectCaptcha(pg) {
  return pg.evaluate(() => {
    const text = document.body.innerText || '';
    return !!(document.querySelector('#captcha-form') ||
             document.querySelector('.g-recaptcha') ||
             document.querySelector('#recaptcha') ||
             text.includes('unusual traffic') ||
             text.includes('are not a robot'));
  });
}

async function waitForCaptchaSolve(pg, timeoutSec = 120) {
  for (let i = 0; i < timeoutSec; i++) {
    await sleep(1000);
    const still = await detectCaptcha(pg);
    if (!still) return true;
  }
  return false;
}

async function scrollPage(pg) {
  await pg.evaluate(async () => {
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const scrollHeight = () => document.body.scrollHeight;
    let prev = 0;
    let curr = scrollHeight();
    while (prev !== curr) {
      window.scrollTo(0, curr);
      await delay(300);
      prev = curr;
      curr = scrollHeight();
    }
    window.scrollTo(0, 0);
  });
}

function getExtractionScript() {
  return (excludedList) => {
    const items = [];
    const seenUrls = new Set();
    const excluded = new Set(excludedList);

    function isDomainExcluded(url) {
      try {
        let d = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        if (excluded.has(d)) return true;
        for (const ex of excluded) {
          if (d.endsWith('.' + ex)) return true;
        }
      } catch (e) {}
      return false;
    }

    function isGoogleUrl(url) {
      try {
        const h = new URL(url).hostname.toLowerCase();
        return h.includes('google.') || h.includes('youtube.') || h.includes('gstatic.') ||
               h.includes('googleapis.') || h.includes('webcache.');
      } catch (e) { return true; }
    }

    function addResult(url, title, snippet) {
      if (!url || seenUrls.has(url)) return;
      if (!url.startsWith('http')) return;
      if (isGoogleUrl(url)) return;
      if (isDomainExcluded(url)) return;
      seenUrls.add(url);
      items.push({ url, title: (title || '').trim().substring(0, 300), snippet: (snippet || '').trim().substring(0, 500) });
    }

    document.querySelectorAll('div.g').forEach(el => {
      const a = el.querySelector('a[href^="http"]');
      const h3 = el.querySelector('h3');
      if (a) {
        const title = h3 ? h3.innerText : '';
        const sn = el.querySelector('[data-sncf], .VwiC3b, .IsZvec, .lEBKkf, span.aCOpRe, .st, [data-content-feature]');
        addResult(a.href, title, sn ? sn.innerText : '');
      }
    });

    const rso = document.querySelector('#rso');
    if (rso) {
      rso.querySelectorAll('a[href^="http"]').forEach(a => {
        const parent = a.closest('[data-hveid]') || a.closest('[data-ved]') || a.closest('div[class]');
        const h3 = a.querySelector('h3') || parent?.querySelector('h3');
        const title = h3 ? h3.innerText : (a.innerText || '').substring(0, 100);
        if (title && title.length > 3) addResult(a.href, title, '');
      });
    }

    document.querySelectorAll('h3').forEach(h3 => {
      const link = h3.closest('a') ||
                   h3.querySelector('a[href^="http"]') ||
                   h3.parentElement?.querySelector('a[href^="http"]') ||
                   h3.parentElement?.parentElement?.querySelector('a[href^="http"]') ||
                   h3.closest('div')?.querySelector('a[href^="http"]');
      if (link && link.href && link.href.startsWith('http')) {
        addResult(link.href, h3.innerText, '');
      }
    });

    document.querySelectorAll('cite').forEach(cite => {
      let urlText = cite.innerText.trim();
      if (!urlText.startsWith('http')) urlText = 'https://' + urlText;
      urlText = urlText.split(' ')[0].replace(/›/g, '/').replace(/\s/g, '');
      try {
        const parsed = new URL(urlText);
        const container = cite.closest('[data-hveid]') || cite.closest('div.g') || cite.closest('div');
        const h3 = container?.querySelector('h3');
        addResult(parsed.href, h3 ? h3.innerText : '', '');
      } catch (e) {}
    });

    const searchContainer = document.querySelector('#search') || document.querySelector('#center_col');
    if (searchContainer) {
      searchContainer.querySelectorAll('a[href^="http"]').forEach(a => {
        const text = a.querySelector('h3')?.innerText || a.getAttribute('aria-label') || '';
        if (text && text.length > 3 && text.length < 300) {
          addResult(a.href, text, '');
        }
      });
    }

    document.querySelectorAll('[data-href^="http"]').forEach(el => {
      const href = el.getAttribute('data-href');
      const h3 = el.querySelector('h3') || el.closest('div')?.querySelector('h3');
      addResult(href, h3 ? h3.innerText : el.innerText?.substring(0, 100) || '', '');
    });

    const bodyText = document.body.innerText || '';
    const isNoResults = bodyText.includes('did not match any documents') ||
      bodyText.includes('No results found');

    const hasNextPage = !!(
      document.querySelector('a#pnnext') ||
      document.querySelector('a[aria-label="Next page"]') ||
      document.querySelector('a[aria-label="Next"]') ||
      document.querySelector('td.navend a') ||
      document.querySelector('table#nav td:last-child a') ||
      document.querySelector('[aria-label="Page 2"]')
    );

    return { items, hasNextPage, isNoResults, totalFound: items.length };
  };
}

async function searchGoogle(query, maxResults = 20, onResult) {
  if (!browser || !isReady) throw new Error('Browser not launched');

  page = await getActivePage();
  if (!page) throw new Error('No active browser page');

  const results = [];
  const seenDomains = new Set();
  let totalRaw = 0;
  const maxPages = 50;
  let noNewResultsStreak = 0;

  await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 15000 });
  await sleep(500);

  const searchBox = await page.$('textarea[name="q"], input[name="q"]');
  if (!searchBox) {
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } else {
    await searchBox.click({ clickCount: 3 });
    await sleep(100);
    await searchBox.type(query, { delay: 30 + Math.random() * 50 });
    await sleep(300);
    await searchBox.press('Enter');
  }

  try {
    await page.waitForSelector('#search, #rso, div.g', { timeout: 10000 });
  } catch (e) {}
  await sleep(800);

  for (let pageNum = 0; pageNum < maxPages; pageNum++) {
    if (results.length >= maxResults) break;

    try {
      if (await detectCaptcha(page)) {
        const solved = await waitForCaptchaSolve(page);
        if (!solved) break;
        await sleep(1500);
        if (await detectCaptcha(page)) {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
          await sleep(1000);
          if (await detectCaptcha(page)) break;
        }
      }

      await scrollPage(page);
      await sleep(300);

      if (pageNum === 0) {
        const noResults = await page.evaluate(() => {
          const text = document.body.innerText || '';
          return text.includes('did not match any documents') && !document.querySelector('div.g');
        });
        if (noResults) break;
      }

      const pageResults = await page.evaluate(getExtractionScript(), Array.from(EXCLUDED_DOMAINS));
      const extracted = pageResults.items || [];
      totalRaw += extracted.length;

      let newCount = 0;
      for (const r of extracted) {
        if (results.length >= maxResults) break;
        let domain;
        try { domain = new URL(r.url).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { continue; }
        if (seenDomains.has(domain) || isExcludedDomain(domain)) continue;
        seenDomains.add(domain);
        results.push({ ...r, domain, source: 'Google' });
        newCount++;
        if (onResult) onResult(results[results.length - 1]);
      }

      if (results.length >= maxResults) break;

      if (newCount === 0) {
        noNewResultsStreak++;
      } else {
        noNewResultsStreak = 0;
      }

      if (noNewResultsStreak >= 5) break;

      const nextClicked = await page.evaluate(() => {
        const next = document.querySelector('a#pnnext') ||
                     document.querySelector('a[aria-label="Next page"]') ||
                     document.querySelector('a[aria-label="Next"]');
        if (next) {
          next.scrollIntoView();
          next.click();
          return 'clicked';
        }
        const pageNums = document.querySelectorAll('table#nav td a, [aria-label^="Page"]');
        if (pageNums.length > 0) {
          let highest = null;
          let highestNum = 0;
          pageNums.forEach(a => {
            const num = parseInt(a.innerText);
            if (num > highestNum) { highestNum = num; highest = a; }
          });
          if (highest) { highest.scrollIntoView(); highest.click(); return 'page_num'; }
        }
        return 'none';
      });

      if (nextClicked === 'none') {
        const nextUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${(pageNum + 1) * 10}`;
        await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(600);
        continue;
      }

      try {
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
      } catch (e) {}
      await sleep(600);

      const currentStart = await page.evaluate(() => {
        const url = new URL(window.location.href);
        return parseInt(url.searchParams.get('start') || '0');
      });
      const expectedStart = (pageNum + 1) * 10;
      if (currentStart < expectedStart - 5) {
        const nextUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${expectedStart}`;
        await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(600);
      }

      await sleep(400 + Math.random() * 400);

    } catch (err) {
      console.error(`Search page ${pageNum + 1} error:`, err.message);
      try {
        const nextUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=${(pageNum + 1) * 10}`;
        await page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await sleep(600);
      } catch (e) {}
    }
  }

  return results;
}

async function closeBrowser() {
  if (browser) {
    try { await browser.close(); } catch (e) {}
    browser = null;
    page = null;
    isReady = false;
  }
  return { success: true };
}

function multiSearch(query, maxResults = 50, onResult) {
  return searchGoogle(query, maxResults, onResult);
}

function getBrowserStatus() {
  if (browser && !browser.isConnected()) {
    browser = null;
    page = null;
    isReady = false;
  }
  return {
    launched: !!browser,
    ready: isReady,
  };
}

function getBrowser() {
  return browser;
}

module.exports = { launchBrowser, closeBrowser, checkReady, searchGoogle, multiSearch, getBrowserStatus, getBrowser, EXCLUDED_DOMAINS };
