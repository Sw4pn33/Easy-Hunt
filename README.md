<div align="center">

# 🎯 Easy-Hunt

### Smart Bug Bounty Reconnaissance & Outreach Tool

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-24.x-40B5A4?logo=puppeteer&logoColor=white)](https://pptr.dev/)

<br>

**Stop wasting hours finding bug bounty targets manually.**
Easy-Hunt automates the entire recon → extract → outreach pipeline.

Find programs → Extract security contacts → Send reports → Track responses → Hunt smarter.

<br>

[🚀 Quick Start](#-quick-start) · [📖 How It Works](#-how-it-works) · [🎯 Use Cases](#-use-cases) · [⚙️ Configuration](#%EF%B8%8F-configuration)

</div>

---

## 💡 The Problem

You spend **hours** doing Google dorking to find bug bounty programs, then **more hours** manually visiting each site to find their security contact, then **even more time** sending individual vulnerability reports — only for most companies to **never respond**.

**Easy-Hunt solves this entire workflow:**

```
🔍 Dorking → 📧 Extraction → ✉️ Outreach → 📊 Track Responses
   (auto)      (auto)          (one-click)     (smart filter)
```

## 🎯 Use Cases

### 🏹 Pre-Hunt Reconnaissance
> *"Which companies actually respond to security reports?"*

Send a **mock/initial disclosure inquiry** to hundreds of extracted security contacts at once. Companies that reply quickly are more likely to have active programs — focus your hunting there. **Save days of wasted effort.**

### 📬 Bulk Vulnerability Reporting
> *"I found the same vulnerability pattern across 50 sites"*

Extract all security emails → Load a report template → Send to all at once via Gmail BCC or SMTP. No more copy-pasting emails one by one.

### 🗺️ Target Discovery
> *"I want to find programs that aren't on HackerOne/Bugcrowd"*

Easy-Hunt finds **self-hosted** bug bounty and VDP programs through Google dorking — the ones that don't appear on major platforms. Less competition, more unique targets.

### 🏆 Hall of Fame Hunting
> *"I want easy wins for my security researcher portfolio"*

Use the Hall of Fame and Swag dork categories to find programs that acknowledge researchers. Submit valid reports → Get listed → Build your reputation.

---

## ✨ Features

<table>
<tr>
<td width="50%">

### 🔍 Smart Google Dorking
- **200+ built-in dorks** across 15 categories
- Per-dork or total result modes
- Custom dork input support
- Persistent pagination (up to 50 pages/dork)
- Human-like search behavior
- CAPTCHA detection & manual solve support

</td>
<td width="50%">

### 📧 Intelligent Extraction
- Visits **exact Google URL** first (not just domain)
- `security.txt` auto-detection
- Email extraction with junk/fake filtering
- Program type detection (Bounty/Swag/HoF/VDP)
- Confidence scoring for accuracy
- Visible browser for Cloudflare CAPTCHA solving

</td>
</tr>
<tr>
<td>

### ✉️ Bulk Email Outreach
- **One-click Gmail BCC** — opens compose with all emails
- SMTP direct sending with delay
- 3 built-in report templates
- Paste bulk email lists (auto-parsed)
- Junk email auto-filtering
- Gmail account selector

</td>
<td>

### 📊 Results & Export
- Live results during search
- Filter by program type
- CSV export
- Stop/resume with partial results saved
- Session-based result management
- Real-time progress tracking

</td>
</tr>
</table>

---

## 🖥️ Screenshots

<div align="center">

### Dork Search Panel
> Select from 15 categories with 200+ dorks, set per-dork limits, launch the browser, and start hunting.

<img src="screenshots/dork-search.png" alt="Dork Search Panel" width="800">

### Live Results
> Watch results stream in real-time as each dork is processed. See domain, type, security page, and emails instantly.

<img src="screenshots/live-results.png" alt="Live Results" width="800">

### Email Sender
> Paste or collect emails → Choose template → Open in Gmail with BCC or send via SMTP. Track who responds.

<img src="screenshots/email-sender.png" alt="Email Sender" width="800">

</div>

---

## 🚀 Quick Start

### 🪟 Windows

**Prerequisites:** [Node.js 18+](https://nodejs.org/) • [Google Chrome](https://www.google.com/chrome/)

```powershell
git clone https://github.com/Sw4pn33/Easy-Hunt.git
cd Easy-Hunt
npm install
copy .env.example .env        # optional — edit for SMTP
npm start
```

---

### 🐧 Linux / macOS

**Prerequisites:** Node.js 18+ • Google Chrome or Chromium

```bash
# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs google-chrome-stable    # Debian/Ubuntu
# For macOS: brew install node && brew install --cask google-chrome

git clone https://github.com/Sw4pn33/Easy-Hunt.git
cd Easy-Hunt
npm install
cp .env.example .env           # optional — edit for SMTP
npm start
```

---

### 📱 Termux (Android)

> **Note:** Termux uses Chromium in headless mode. The visible browser window won't open, but dorking and extraction still work. CAPTCHA solving requires manual workaround — use a pre-authenticated Google session or reduce dork volume to avoid CAPTCHAs.

```bash
pkg update && pkg upgrade
pkg install nodejs git chromium
npm config set puppeteer_skip_chromium_download true

git clone https://github.com/Sw4pn33/Easy-Hunt.git
cd Easy-Hunt
npm install

# Set Chromium path for Puppeteer
export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)

cp .env.example .env           # optional — edit for SMTP
npm start
```

---

### Open in Browser

```
http://localhost:4500
```

That's it! 🎉

> **Supported Platforms**
>
> | Platform | Browser | Status |
> |----------|---------|--------|
> | 🪟 Windows 10/11 | Chrome | ✅ Full support |
> | 🐧 Ubuntu / Debian | Chrome / Chromium | ✅ Full support |
> | 🍎 macOS | Chrome | ✅ Full support |
> | 📱 Termux (Android) | Chromium (headless) | ⚠️ No visible browser |
> | 🐧 Kali Linux | Chromium | ✅ Full support |
> | 🐧 Arch / Fedora | Chrome / Chromium | ✅ Full support |

### 🛑 How to Stop

- **Stop a running search** → Click the red **"Stop"** button in the UI (partial results are saved)
- **Close the browser** → Click the green **"Browser Ready"** button (it toggles to close)
- **Shut down Easy-Hunt** → Use any of these methods:
  - Press `Ctrl + C` in the terminal (works even when logs are scrolling)
  - Simply **close the terminal window** — this kills the server and browser
  - On Linux/macOS: `kill $(lsof -t -i:4500)` to force-kill the port

---

## 📖 How It Works

### Step 1: Launch Browser 🌐
Click **"Launch Browser"** — a Chrome window opens and navigates to Google. If a CAPTCHA appears, solve it once manually. After that, everything is automated.

### Step 2: Select Dorks & Search 🔍
Pick dork categories (Bug Bounty, Responsible Disclosure, security.txt, etc.) or enter custom dorks. Set how many results you want per dork. Hit **"Start Hunt"**.

### Step 3: Watch Live Results 📊
Results stream in real-time. Easy-Hunt:
1. Types each dork into Google (human-like)
2. Extracts all unique domains from results
3. Paginates through up to 50 pages per dork
4. Deduplicates across all dorks

### Step 4: Automatic Extraction 🔬
For each found domain, Easy-Hunt:
1. **Visits the exact URL** Google found (already the disclosure page)
2. Checks `security.txt` for contact info
3. Falls back to common security paths (`/security`, `/bug-bounty`, etc.)
4. Extracts emails, forms, program type, and scope
5. Assigns a confidence score

### Step 5: Send Outreach ✉️
Click **"Collect All Emails"** → Switch to Email Sender tab → Choose a template or write your own → Click **"Open in Gmail (BCC)"** to send from your Gmail with Mailsuite tracking, or use SMTP for direct sending.

---

## 🗂️ Dork Categories

| Category | Dorks | Description |
|----------|-------|-------------|
| 🐛 Bug Bounty Programs | 30 | Programs offering monetary rewards |
| 🛡️ Responsible Disclosure | 24 | VDP policies and reporting pages |
| 📄 security.txt Files | 18 | RFC 9116 security contact files |
| 🎁 Swag Programs | 12 | Programs offering merchandise/swag |
| 🏆 Hall of Fame | 12 | Programs that acknowledge researchers |
| 🖥️ Platform-Powered | 13 | Bugcrowd/HackerOne powered programs |
| 🏛️ Government & Military | 12 | .gov and .mil programs |
| 🎓 University & Education | 9 | .edu security programs |
| 🇪🇺 Europe | 19 | European country-specific programs |
| 🌏 Asia & Pacific | 6 | APAC region programs |
| 🌎 Americas | 4 | North/South America programs |
| 💰 Fintech & Crypto | 13 | Financial and blockchain programs |
| 🛒 E-commerce & Payments | 4 | Shopping and payment platforms |
| 💻 CMS & Open Source | 11 | Open source project programs |
| 🔬 Advanced & Unique | 12 | Uncommon and creative dorks |
| 📡 Wide Scan | 11 | High-volume broad searches |

**Total: 200+ unique Google dorks**

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server port (default: 4500)
PORT=4500

# SMTP Configuration (for direct email sending)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@gmail.com
```

### Gmail App Password Setup

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required)
3. Go to **App passwords** (search "App passwords" in account settings)
4. Generate a new app password for **"Mail"**
5. Copy the 16-character password to `SMTP_PASS` in `.env`

> **Note:** SMTP is optional. You can use the **"Open in Gmail (BCC)"** button instead, which opens your Gmail directly in the browser — no SMTP needed.

---

## 📁 Project Structure

```
Easy-Hunt/
├── server.js              # Express server entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment configuration
├── public/
│   ├── index.html         # Main UI
│   ├── css/
│   │   └── style.css      # Dark theme styles
│   └── js/
│       └── app.js         # Frontend logic
└── src/
    ├── dorks.js           # 200+ Google dork templates
    ├── routes/
    │   ├── search.js      # Search API endpoints
    │   └── email.js       # Email sending endpoints
    └── utils/
        ├── searchEngine.js  # Puppeteer Google search engine
        └── extractor.js     # Security info extraction pipeline
```

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search/dorks` | Get all dork templates |
| `POST` | `/api/search/launch-browser` | Launch Puppeteer browser |
| `GET` | `/api/search/browser-status` | Check browser readiness |
| `POST` | `/api/search/close-browser` | Close browser |
| `POST` | `/api/search/start` | Start a dork search |
| `GET` | `/api/search/progress/:id` | Get search progress & results |
| `POST` | `/api/search/stop/:id` | Stop search (saves partial results) |
| `GET` | `/api/search/export/:id` | Export results as CSV |
| `POST` | `/api/email/send` | Send bulk emails via SMTP |
| `GET` | `/api/email/templates` | Get email templates |

---

## 🛡️ Smart Email Filtering

Easy-Hunt automatically filters out junk and fake emails:

- ❌ Placeholder emails (`example.com`, `test.com`, `domain.com`)
- ❌ System emails (`noreply`, `no-reply`, `donotreply`)
- ❌ Invalid TLDs (random strings like `.avp`, `.xvz`)
- ❌ Keyboard mashing domains (5+ consecutive consonants)
- ❌ Asset emails (`.png`, `.jpg`, `.css`, `.js` extensions)
- ❌ Unicode-escaped prefixes (`u003e` cleanup)
- ✅ Validates against 150+ known TLDs
- ✅ Deduplicates across all sources

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Ideas for Contribution
- [ ] Add more dork templates for specific industries
- [ ] Bing/DuckDuckGo search engine support
- [ ] Result persistence with SQLite
- [ ] Email open tracking (tracking pixel)
- [ ] Scheduled/recurring searches
- [ ] Browser extension for quick dork searches
- [ ] Dark/light theme toggle

---

## ⚠️ Disclaimer

> **Important:** Easy-Hunt is a **script-based automation tool**, not an AI-powered system. It performs Google dorking, page scraping, and pattern matching using predefined rules and heuristics. **It does not guarantee 100% accuracy.** Results may include false positives, miss valid programs, or extract incorrect contact information. **Always perform manual verification** before sending any vulnerability reports or outreach emails. Review each result, confirm the security contact is correct, and ensure the organization has an active disclosure program before reaching out.

This tool is intended for **authorized security research** and **responsible disclosure** only. Users are responsible for ensuring they comply with:

- Google's Terms of Service
- Applicable computer fraud and abuse laws
- Each organization's vulnerability disclosure policy
- CAN-SPAM Act (for email outreach)

**Do not** use this tool for:
- Unauthorized access to systems
- Spamming or unsolicited bulk email
- Any illegal activities

The author is not responsible for misuse of this tool.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with ❤️ for the bug bounty community**

⭐ Star this repo if you find it useful!

[Report Bug](https://github.com/Sw4pn33/Easy-Hunt/issues) · [Request Feature](https://github.com/Sw4pn33/Easy-Hunt/issues)

</div>
