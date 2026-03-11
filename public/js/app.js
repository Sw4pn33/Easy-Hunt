
let dorkTemplates = {};
let selectedCategories = new Set();
let currentSessionId = null;
let searchResults = [];
let collectedEmails = new Set();
let emailTemplates = [];
let pollInterval = null;
let browserLaunched = false;
let resultMode = 'perDork';


document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
  });
  document.getElementById('filterInput').addEventListener('input', renderResults);
  await Promise.all([loadDorks(), loadEmailTemplates(), checkBrowserStatus()]);
  loadSavedEmails();


  var emailInput = document.getElementById('addEmailInput');
  if (emailInput) {
    emailInput.addEventListener('paste', function (e) {
      var clipText = (e.clipboardData || window.clipboardData).getData('text');
      if (clipText && clipText.includes('@')) {
        e.preventDefault();
        var added = bulkAddEmails(clipText);
        emailInput.value = '';
        if (added > 0) showToast('Added ' + added + ' emails (duplicates/junk filtered)', 'success');
        else showToast('No valid emails found in pasted text', 'error');
      }
    });
  }
});

function switchPanel(panel) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`[data-panel="${panel}"]`).classList.add('active');
  document.getElementById(`panel-${panel}`).classList.add('active');
}


async function checkBrowserStatus() {
  try {
    const res = await fetch('/api/search/browser-status');
    const data = await res.json();
    browserLaunched = data.launched && data.ready;
    updateBrowserUI(data);
  } catch (err) { }
}

function updateBrowserUI(data) {
  const btn = document.getElementById('btnBrowser');
  const status = document.getElementById('browserStatus');
  if (data.launched && data.ready) {
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Browser Ready';
    btn.className = 'btn btn-success';
    btn.onclick = closeBrowserSession;
    status.innerHTML = '<i class="fas fa-circle" style="color:var(--green);font-size:0.5rem"></i> Connected to Google';
    browserLaunched = true;
  } else if (data.launched && !data.ready) {
    btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Solve CAPTCHA';
    btn.className = 'btn btn-danger';
    btn.onclick = () => { showToast('Solve the CAPTCHA in the browser window', 'error'); setTimeout(checkBrowserStatus, 5000); };
    status.innerHTML = '<i class="fas fa-circle" style="color:var(--yellow);font-size:0.5rem"></i> CAPTCHA — solve in browser window';
    browserLaunched = false;
  } else {
    btn.innerHTML = '<i class="fas fa-globe"></i> Launch Browser';
    btn.className = 'btn btn-primary';
    btn.onclick = launchBrowserSession;
    status.innerHTML = '<i class="fas fa-circle" style="color:var(--red);font-size:0.5rem"></i> Not connected';
    browserLaunched = false;
  }
}

async function launchBrowserSession() {
  const btn = document.getElementById('btnBrowser');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Launching...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/search/launch-browser', { method: 'POST' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast('Browser launched! If CAPTCHA appears, solve it in the browser window.', 'success');
    setTimeout(checkBrowserStatus, 3000);
    setTimeout(checkBrowserStatus, 6000);
    setTimeout(checkBrowserStatus, 10000);
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
  btn.disabled = false;
  checkBrowserStatus();
}

async function closeBrowserSession() {
  await fetch('/api/search/close-browser', { method: 'POST' });
  browserLaunched = false;
  checkBrowserStatus();
  showToast('Browser closed', 'success');
}


async function loadDorks() {
  try {
    const res = await fetch('/api/search/dorks');
    const data = await res.json();
    if (data.success) { dorkTemplates = data.dorks; renderDorkGrid(); }
  } catch (err) { showToast('Failed to load dorks', 'error'); }
}

function renderDorkGrid() {
  const grid = document.getElementById('dorkGrid');
  grid.innerHTML = '';
  let totalDorks = 0;
  for (const [key, cat] of Object.entries(dorkTemplates)) {
    totalDorks += cat.dorks.length;
    const card = document.createElement('div');
    card.className = `dork-card ${selectedCategories.has(key) ? 'selected' : ''}`;
    card.onclick = () => toggleDork(key);
    card.innerHTML = `
      <div class="check">${selectedCategories.has(key) ? '<i class="fas fa-check"></i>' : ''}</div>
      <div class="icon" style="color:${cat.color}"><i class="fas ${cat.icon}"></i></div>
      <div class="name">${cat.label}</div>
      <div class="count">${cat.dorks.length} dorks</div>`;
    grid.appendChild(card);
  }
  document.getElementById('totalDorkCount').textContent = totalDorks;
}

function toggleDork(key) {
  if (selectedCategories.has(key)) selectedCategories.delete(key);
  else selectedCategories.add(key);
  renderDorkGrid();
}

function selectAllDorks() { Object.keys(dorkTemplates).forEach(k => selectedCategories.add(k)); renderDorkGrid(); }
function clearAllDorks() { selectedCategories.clear(); renderDorkGrid(); }


function setResultMode(mode) {
  resultMode = mode;
  document.querySelectorAll('.mode-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  var hint = document.getElementById('modeHint');
  if (mode === 'perDork') {
    hint.textContent = 'Each dork fetches up to selected limit';
  } else {
    hint.textContent = 'All dorks combined reach the total limit';
  }
}


async function startSearch() {
  if (!browserLaunched) {
    showToast('Launch browser first! Click the "Launch Browser" button.', 'error');
    return;
  }

  const dorks = [];
  for (const key of selectedCategories) {
    if (dorkTemplates[key]) dorks.push(...dorkTemplates[key].dorks);
  }
  const customText = document.getElementById('customDorks').value.trim();
  if (customText) customText.split('\n').forEach(line => { const d = line.trim(); if (d) dorks.push(d); });

  if (dorks.length === 0) { showToast('Select at least one category or enter custom dorks', 'error'); return; }

  const maxResults = parseInt(document.getElementById('maxResults').value);

  document.getElementById('btnSearch').style.display = 'none';
  document.getElementById('btnStop').style.display = 'inline-flex';
  document.getElementById('progressSection').style.display = 'block';
  document.getElementById('liveResultsSection').style.display = 'block';
  document.getElementById('liveResultsBody').innerHTML = '';
  searchResults = [];

  try {
    const res = await fetch('/api/search/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dorks, maxResults, mode: resultMode }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    currentSessionId = data.sessionId;
    pollProgress();
  } catch (err) {
    showToast('Search failed: ' + err.message, 'error');
    resetSearchUI();
  }
}

function pollProgress() {
  if (pollInterval) clearInterval(pollInterval);
  let lastCount = 0;

  pollInterval = setInterval(async () => {
    if (!currentSessionId) { clearInterval(pollInterval); return; }

    try {
      const res = await fetch('/api/search/progress/' + currentSessionId);
      const data = await res.json();

      const pct = data.total > 0 ? Math.round((data.progress / data.total) * 100) : 0;
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressPercent').textContent = pct + '%';

      if (data.phase === 'dorking') {
        document.getElementById('progressLabel').textContent = 'Dorking... (' + data.progress + '/' + data.total + ' queries)';
        const dorkText = data.currentDork || '';
        let detail = 'Found ' + data.resultsCount + ' unique sites';
        if (dorkText) detail += ' | Current: ' + dorkText.substring(0, 70) + (dorkText.length > 70 ? '...' : '');
        if (data.captchaWaiting) detail = 'CAPTCHA detected — solve it in the browser window!';
        document.getElementById('progressDetail').textContent = detail;
      } else if (data.phase === 'extracting') {
        document.getElementById('progressLabel').textContent = 'Extracting security info... (' + data.progress + '/' + data.total + ')';
        document.getElementById('progressDetail').textContent = 'Checking security.txt, security pages, emails...';
      }

      if (data.results && data.results.length > lastCount) {
        appendLiveResults(data.results.slice(lastCount));
        lastCount = data.results.length;
      }

      document.getElementById('statSites').textContent = data.resultsCount;
      const badge = document.getElementById('resultsCount');
      badge.textContent = data.resultsCount;
      badge.style.display = data.resultsCount > 0 ? 'inline' : 'none';

      if (data.status === 'completed' || data.status === 'stopped') {
        clearInterval(pollInterval);
        searchResults = data.results || [];
        updateStats();
        renderResults();
        resetSearchUI();
        showToast('Done! Found ' + searchResults.length + ' sites', 'success');
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, 2000);
}

function appendLiveResults(newResults) {
  const tbody = document.getElementById('liveResultsBody');
  for (const r of newResults) {
    const tr = document.createElement('tr');
    tr.className = 'slide-up';
    const typeInfo = getTypeInfo(r.programType);
    const emails = (r.securityEmails || []).join(', ') || '-';
    const secPage = r.securityPage ? '<a href="' + r.securityPage + '" target="_blank"><i class="fas fa-external-link-alt"></i></a>' : '-';
    const secTxt = r.hasSecurityTxt ? '<span style="color:var(--green)"><i class="fas fa-check"></i></span>' : '-';

    tr.innerHTML = '<td><a href="' + r.url + '" target="_blank" style="font-weight:600">' + r.domain + '</a><div style="font-size:0.7rem;color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (r.title || '') + '</div></td><td><span class="badge ' + typeInfo.cls + '"><i class="fas fa-circle" style="font-size:0.35rem"></i> ' + typeInfo.label + '</span></td><td>' + secPage + '</td><td style="font-size:0.75rem;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + emails + '</td><td>' + secTxt + '</td><td style="font-size:0.72rem;color:var(--text-muted)">' + (r.source || '') + '</td>';
    tbody.appendChild(tr);
  }
  const container = document.getElementById('liveResultsContainer');
  container.scrollTop = container.scrollHeight;
}

function getTypeInfo(type) {
  switch (type) {
    case 'bounty': return { cls: 'badge-bounty', label: 'Bounty' };
    case 'swag': return { cls: 'badge-swag', label: 'Swag' };
    case 'hof': return { cls: 'badge-hof', label: 'HoF' };
    case 'vdp': return { cls: 'badge-vdp', label: 'VDP' };
    default: return { cls: 'badge-unknown', label: 'Pending' };
  }
}

async function stopSearch() {
  if (currentSessionId) {
    try {
      await fetch('/api/search/stop/' + currentSessionId, { method: 'POST' });
      const res = await fetch('/api/search/progress/' + currentSessionId);
      const data = await res.json();
      searchResults = data.results || [];
      updateStats();
      renderResults();
    } catch (e) { }
  }
  if (pollInterval) clearInterval(pollInterval);
  resetSearchUI();
  showToast('Search stopped', 'error');
}

function resetSearchUI() {
  document.getElementById('btnSearch').style.display = 'inline-flex';
  document.getElementById('btnStop').style.display = 'none';
  document.getElementById('progressSection').style.display = 'none';
  document.getElementById('progressFill').style.width = '0%';
}


function updateStats() {
  document.getElementById('statSites').textContent = searchResults.length;
  const allEmails = searchResults.flatMap(r => r.securityEmails || []);
  document.getElementById('statEmails').textContent = new Set(allEmails).size;
  document.getElementById('statBounty').textContent = searchResults.filter(r => r.programType === 'bounty').length;
  document.getElementById('statHof').textContent = searchResults.filter(r => r.programType === 'hof').length;
  const badge = document.getElementById('resultsCount');
  badge.textContent = searchResults.length;
  badge.style.display = searchResults.length > 0 ? 'inline' : 'none';
}

function renderResults() {
  const tbody = document.getElementById('resultsBody');
  const noResults = document.getElementById('noResults');
  const filter = document.getElementById('filterInput').value.toLowerCase();
  const typeFilter = document.getElementById('filterType').value;

  let filtered = searchResults;
  if (filter) {
    filtered = filtered.filter(r =>
      (r.domain && r.domain.toLowerCase().includes(filter)) ||
      (r.title && r.title.toLowerCase().includes(filter)) ||
      (r.securityEmails || []).some(e => e.toLowerCase().includes(filter))
    );
  }
  if (typeFilter !== 'all') filtered = filtered.filter(r => r.programType === typeFilter);

  if (filtered.length === 0) { tbody.innerHTML = ''; noResults.style.display = 'block'; return; }
  noResults.style.display = 'none';

  tbody.innerHTML = filtered.map(function (r, i) {
    var ti = getTypeInfo(r.programType);
    var emails = (r.securityEmails || []).map(function (e) {
      return '<a href="mailto:' + e + '" style="font-size:0.75rem;display:block">' + e + '</a>';
    }).join('') || '<span style="color:var(--text-muted);font-size:0.75rem">None</span>';

    var secPage = r.securityPage
      ? '<a href="' + r.securityPage + '" target="_blank" style="font-size:0.75rem"><i class="fas fa-external-link-alt"></i> View</a>'
      : '<span style="color:var(--text-muted);font-size:0.75rem">-</span>';

    return '<tr class="slide-up"><td><input type="checkbox" class="result-check" data-index="' + i + '"></td><td><div style="font-weight:600;font-size:0.85rem"><a href="' + r.url + '" target="_blank">' + r.domain + '</a></div><div style="font-size:0.72rem;color:var(--text-muted);max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (r.title || '') + '</div></td><td><span class="badge ' + ti.cls + '"><i class="fas fa-circle" style="font-size:0.4rem"></i> ' + ti.label + '</span></td><td>' + secPage + '</td><td>' + emails + '</td><td>' + (r.hasSecurityTxt ? '<span style="color:var(--green)"><i class="fas fa-check-circle"></i> Yes</span>' : '<span style="color:var(--text-muted)">No</span>') + '</td><td style="font-size:0.72rem;color:var(--text-muted)">' + (r.source || '') + '</td></tr>';
  }).join('');
}

function toggleSelectAll(checkbox) { document.querySelectorAll('.result-check').forEach(function (c) { c.checked = checkbox.checked; }); }

function collectAllEmails() {
  collectedEmails.clear();
  var added = 0;
  var skipped = 0;
  searchResults.forEach(function (r) {
    (r.securityEmails || []).forEach(function (e) {
      var cleaned = cleanEmailFrontend(e);
      if (cleaned && !isJunkEmailFrontend(cleaned) && !collectedEmails.has(cleaned)) {
        collectedEmails.add(cleaned);
        added++;
      } else {
        skipped++;
      }
    });
  });
  renderEmailList();
  updateSendCount();
  switchPanel('email');
  var msg = 'Collected ' + added + ' valid emails';
  if (skipped > 0) msg += ' (' + skipped + ' junk/duplicates filtered)';
  showToast(msg, 'success');
}


function renderEmailList() {
  var list = document.getElementById('emailList');
  var arr = Array.from(collectedEmails);
  if (arr.length === 0) {
    list.innerHTML = '<span style="color:var(--text-muted);font-size:0.82rem">No emails yet. Run a search or add manually.</span>';
  } else {
    list.innerHTML = arr.map(function (e) {
      return '<div class="email-chip"><span>' + e + '</span><div class="remove" onclick="removeEmail(\'' + e + '\')"><i class="fas fa-times"></i></div></div>';
    }).join('');
  }
  document.getElementById('emailCount').textContent = arr.length + ' emails';
  updateSendCount();
}

function cleanEmailFrontend(raw) {
  if (!raw) return null;
  var email = raw.trim().toLowerCase()
    .replace(/^u003e/gi, '')  // unicode > escape from JSON
    .replace(/^\\u003e/gi, '')
    .replace(/^>/g, '')
    .replace(/^mailto:/i, '')
    .replace(/^<|>$/g, '')
    .split('?')[0]
    .split('#')[0]
    .trim();
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email)) return null;
  return email;
}

function isJunkEmailFrontend(email) {
  if (!email) return true;
  var junkPatterns = ['example.com', 'emailaddress.com', 'sentry.io', 'wixpress.com',
    'w3.org', 'schema.org', 'yourcompany.com', 'company.com', 'domain.com',
    'test.com', 'placeholder.com', 'sample.com', 'noreply', 'no-reply',
    'donotreply', 'localhost', '.png', '.jpg', '.gif', '.svg', '.css'];
  for (var i = 0; i < junkPatterns.length; i++) {
    if (email.indexOf(junkPatterns[i]) !== -1) return true;
  }
  var domain = email.split('@')[1];
  if (!domain) return true;
  var parts = domain.split('.');
  var tld = parts[parts.length - 1];
  if (tld.length < 2 || tld.length > 12) return true;
  if (tld.length <= 3) {
    var validTLDs = 'com,org,net,edu,gov,mil,int,io,co,us,uk,ca,au,de,fr,jp,cn,in,br,ru,za,nl,se,no,fi,dk,ch,at,be,es,it,pt,pl,cz,hu,ro,bg,hr,sk,si,lt,lv,ee,ie,lu,mt,cy,gr,tr,il,ae,sg,hk,tw,kr,th,my,ph,vn,id,pk,bd,np,lk,nz,mx,ar,cl,pe,ke,ng,gh,eg,ma,tz,ug,me,tv,cc,biz,ai,ml,gg,ly,is,to,fm,am,pm,ac,do,eu,ua,uz,kz,ge,by,rs,ba,mk,al,md,mn,la,mm,kg,tj,sh';
    if (validTLDs.split(',').indexOf(tld) === -1) return true;
  }
  var domainName = parts.slice(0, -1).join('');
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(domainName)) return true;
  return false;
}

function bulkAddEmails(text) {
  var lines = text.split(/[\n\r,;\s]+/);
  var added = 0;
  lines.forEach(function (line) {
    var cleaned = cleanEmailFrontend(line);
    if (cleaned && !isJunkEmailFrontend(cleaned) && !collectedEmails.has(cleaned)) {
      collectedEmails.add(cleaned);
      added++;
    }
  });
  renderEmailList();
  return added;
}

function addManualEmail() {
  var input = document.getElementById('addEmailInput');
  var raw = input.value.trim();
  if (!raw) { showToast('Enter an email', 'error'); return; }

  var atCount = (raw.match(/@/g) || []).length;
  if (atCount > 1 || /[\n,;]/.test(raw)) {
    var added = bulkAddEmails(raw);
    input.value = '';
    if (added > 0) showToast('Added ' + added + ' emails (duplicates/junk filtered)', 'success');
    else showToast('No valid emails found', 'error');
    return;
  }

  var email = cleanEmailFrontend(raw);
  if (!email) { showToast('Invalid email format', 'error'); return; }
  if (isJunkEmailFrontend(email)) { showToast('This looks like a junk/fake email', 'error'); return; }
  collectedEmails.add(email);
  input.value = '';
  renderEmailList();
}

function removeEmail(email) { collectedEmails.delete(email); renderEmailList(); }
function clearEmails() { collectedEmails.clear(); renderEmailList(); }
function copyEmails() { navigator.clipboard.writeText(Array.from(collectedEmails).join('\n')); showToast('Copied!', 'success'); }
function updateSendCount() { document.getElementById('sendCount').textContent = collectedEmails.size; }


function saveFromEmail() {
  var email = (document.getElementById('fromEmail').value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) { showToast('Enter a valid email first', 'error'); return; }
  var saved = JSON.parse(localStorage.getItem('bbh_from_emails') || '[]');
  if (saved.indexOf(email) === -1) {
    saved.push(email);
    localStorage.setItem('bbh_from_emails', JSON.stringify(saved));
    loadSavedEmails();
    showToast('Email saved: ' + email, 'success');
  } else {
    showToast('Already saved', 'success');
  }
}

function loadSavedEmails() {
  var saved = JSON.parse(localStorage.getItem('bbh_from_emails') || '[]');
  var datalist = document.getElementById('savedEmails');
  if (!datalist) return;
  datalist.innerHTML = saved.map(function (e) { return '<option value="' + e + '">'; }).join('');
  if (saved.length === 1 && document.getElementById('fromEmail')) {
    document.getElementById('fromEmail').value = saved[0];
  }
}

async function loadEmailTemplates() {
  try {
    var res = await fetch('/api/email/templates');
    var data = await res.json();
    if (data.success) {
      emailTemplates = data.templates;
      var select = document.getElementById('templateSelect');
      data.templates.forEach(function (t) { var opt = document.createElement('option'); opt.value = t.id; opt.textContent = t.name; select.appendChild(opt); });
      renderTemplatesList();
    }
  } catch (err) { }
}

function loadTemplate() {
  var id = document.getElementById('templateSelect').value;
  if (!id) return;
  var tmpl = emailTemplates.find(function (t) { return t.id === id; });
  if (tmpl) { document.getElementById('emailSubject').value = tmpl.subject; document.getElementById('emailBody').value = tmpl.body; showToast('Template loaded', 'success'); }
}

function renderTemplatesList() {
  document.getElementById('templatesList').innerHTML = emailTemplates.map(function (t) {
    return '<div class="card" style="border-color:var(--border)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem"><h4 style="font-size:0.9rem;font-weight:600">' + t.name + '</h4><button class="btn btn-outline btn-sm" onclick="useTemplate(\'' + t.id + '\')"><i class="fas fa-copy"></i> Use</button></div><div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.35rem"><strong>Subject:</strong> ' + t.subject + '</div><pre style="font-size:0.75rem;color:var(--text-secondary);white-space:pre-wrap;background:var(--bg-secondary);padding:0.75rem;border-radius:8px;max-height:200px;overflow-y:auto;line-height:1.5">' + t.body + '</pre></div>';
  }).join('');
}

function useTemplate(id) { document.getElementById('templateSelect').value = id; loadTemplate(); switchPanel('email'); }

function previewEmail() {
  var subject = document.getElementById('emailSubject').value;
  var body = document.getElementById('emailBody').value;
  var name = document.getElementById('senderName').value;
  if (!subject || !body) { showToast('Fill in subject and body', 'error'); return; }
  var toList = Array.from(collectedEmails).slice(0, 3).join(', ');
  if (collectedEmails.size > 3) toList += ' +' + (collectedEmails.size - 3) + ' more';
  document.getElementById('previewContent').innerHTML = '<div style="border-bottom:1px solid var(--border);padding-bottom:0.75rem;margin-bottom:0.75rem"><div><strong>From:</strong> ' + name + '</div><div><strong>To:</strong> ' + toList + '</div><div><strong>Subject:</strong> ' + subject + '</div></div><div style="white-space:pre-wrap;line-height:1.7">' + body + '</div>';
  document.getElementById('previewModal').style.display = 'flex';
}

function closePreview() { document.getElementById('previewModal').style.display = 'none'; }

async function sendEmails() {
  var emails = Array.from(collectedEmails);
  if (emails.length === 0) { showToast('No emails to send to', 'error'); return; }
  var subject = document.getElementById('emailSubject').value;
  var body = document.getElementById('emailBody').value;
  var fromName = document.getElementById('senderName').value;
  if (!subject || !body) { showToast('Fill in subject and body', 'error'); return; }
  if (!confirm('Send email to ' + emails.length + ' recipients?\n\nSubject: ' + subject)) return;

  document.getElementById('btnSend').disabled = true;
  document.getElementById('sendProgress').style.display = 'block';
  document.getElementById('sendLog').innerHTML = '';

  try {
    var res = await fetch('/api/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails: emails, subject: subject, body: body, fromName: fromName }),
    });
    var data = await res.json();
    if (data.error) {
      showToast(data.error, 'error');
      document.getElementById('sendLog').innerHTML = '<div style="color:var(--red)">' + data.error + '</div>';
    } else {
      document.getElementById('sendProgressFill').style.width = '100%';
      var log = document.getElementById('sendLog');
      data.results.forEach(function (r) {
        var color = r.status === 'sent' ? 'var(--green)' : 'var(--red)';
        var icon = r.status === 'sent' ? 'check' : 'times';
        log.innerHTML += '<div style="color:' + color + '"><i class="fas fa-' + icon + '"></i> ' + r.email + ' - ' + r.status + (r.error ? ': ' + r.error : '') + '</div>';
      });
      showToast('Sent: ' + data.sent + '/' + data.total + ', Failed: ' + data.failed, data.failed > 0 ? 'error' : 'success');
    }
  } catch (err) { showToast('Send failed: ' + err.message, 'error'); }
  document.getElementById('btnSend').disabled = false;
}

function openInGmail() {
  var emails = Array.from(collectedEmails);
  if (emails.length === 0) { showToast('No emails to send to', 'error'); return; }
  var fromEmail = (document.getElementById('fromEmail').value || '').trim();
  var subject = document.getElementById('emailSubject').value;
  var body = document.getElementById('emailBody').value;
  if (!fromEmail || !fromEmail.includes('@')) { showToast('Enter your Gmail address in "Send From" field', 'error'); document.getElementById('fromEmail').focus(); return; }
  if (!subject || !body) { showToast('Fill in subject and body first', 'error'); return; }

  var gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1'
    + '&from=' + encodeURIComponent(fromEmail)
    + '&bcc=' + encodeURIComponent(emails.join(','))
    + '&su=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body);

  if (gmailUrl.length > 8000) {
    var proceed = confirm(
      'You have ' + emails.length + ' emails (' + gmailUrl.length + ' chars in URL).\n\n' +
      'Gmail URLs have a ~8000 character limit. If the page opens blank, try with fewer emails.\n\n' +
      'Continue anyway?'
    );
    if (!proceed) return;
  }

  window.open(gmailUrl, '_blank');
  showToast('Gmail opened from ' + fromEmail + ' with ' + emails.length + ' BCC recipients', 'success');
}

function exportCSV() {
  if (currentSessionId) { window.open('/api/search/export/' + currentSessionId, '_blank'); showToast('CSV downloading...', 'success'); return; }
  if (searchResults.length === 0) { showToast('No results', 'error'); return; }
  var rows = [['Domain', 'URL', 'Title', 'Security Page', 'Security Emails', 'Program Type', 'security.txt', 'Source']];
  searchResults.forEach(function (r) {
    rows.push([r.domain || '', r.url || '', (r.title || '').replace(/"/g, '""'), r.securityPage || '', (r.securityEmails || []).join('; '), r.programType || '', r.hasSecurityTxt ? 'Yes' : 'No', r.source || '']);
  });
  var csv = rows.map(function (r) { return r.map(function (c) { return '"' + c + '"'; }).join(','); }).join('\n');
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'easyhunt-' + Date.now() + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  showToast('Downloaded!', 'success');
}

function showToast(msg, type) {
  type = type || 'success';
  var container = document.getElementById('toastContainer');
  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  var icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
  var color = type === 'success' ? 'var(--green)' : 'var(--red)';
  toast.innerHTML = '<i class="fas fa-' + icon + '" style="color:' + color + '"></i> ' + msg;
  container.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 4000);
}

var modal = document.getElementById('previewModal');
if (modal) modal.addEventListener('click', function (e) { if (e.target.id === 'previewModal') closePreview(); });
