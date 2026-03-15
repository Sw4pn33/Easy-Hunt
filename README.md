<div align="center">

# Easy-Hunt

**Smart Bug Bounty Reconnaissance & Outreach Tool**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](#docker)

Automate Google dorking, extract security contacts, send bulk reports — all in one tool.

[Quick Start](#quick-start) · [Docker](#docker) · [VPS Deploy](#vps-deployment) · [Configuration](#configuration)

</div>

---

## What It Does

```
Google Dorking → Security Contact Extraction → Bulk Email Outreach
   (200+ dorks)     (security.txt, emails)       (Gmail BCC / SMTP)
```

- **200+ Google dorks** across 15 categories (bug bounty, VDP, gov, edu, fintech, etc.)
- **Smart extraction** — visits exact URLs, detects `security.txt`, extracts emails with junk filtering
- **Bulk outreach** — Gmail BCC or SMTP with built-in report templates
- **CSV export**, confidence scoring, real-time progress, stop/resume support

---

## Quick Start

```bash
git clone https://github.com/Sw4pn33/Easy-Hunt.git
cd Easy-Hunt
npm install
cp .env.example .env    # optional — edit for SMTP
npm start
```

Open `http://localhost:4500`

**Requirements:** Node.js 18+ and Google Chrome/Chromium

---

## Docker

```bash
# Build
docker build -t easy-hunt .

# Run
docker run -d -p 4500:4500 --name easy-hunt easy-hunt

# With SMTP config
docker run -d -p 4500:4500 \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=you@gmail.com \
  -e SMTP_PASS=your_app_password \
  -e SMTP_FROM=you@gmail.com \
  easy-hunt
```

Open `http://localhost:4500`

> **Note:** Docker runs in headless mode (no visible browser window). Dorking and extraction work fully, but you can't manually solve CAPTCHAs. For CAPTCHA support, use the native install.

---

## VPS Deployment

Works on any Ubuntu/Debian VPS (1GB+ RAM recommended).

### Option 1: Docker (Recommended)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone and run
git clone https://github.com/Sw4pn33/Easy-Hunt.git
cd Easy-Hunt
docker build -t easy-hunt .
docker run -d -p 4500:4500 --restart unless-stopped --name easy-hunt easy-hunt
```

### Option 2: Native

```bash
# Install Node.js + Chromium
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs chromium-browser

# Clone and run
git clone https://github.com/Sw4pn33/Easy-Hunt.git
cd Easy-Hunt
npm install
export HEADLESS=true
export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser)

# Run with PM2 (persistent)
npm i -g pm2
pm2 start server.js --name easy-hunt
pm2 save && pm2 startup
```

### Access Remotely

```bash
# Direct access (replace with your VPS IP)
http://YOUR_VPS_IP:4500

# Or use Nginx reverse proxy
sudo apt install nginx
```

<details>
<summary>Nginx config (optional — for domain/SSL)</summary>

```nginx
server {
    listen 80;
    server_name hunt.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4500;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Then: `sudo certbot --nginx -d hunt.yourdomain.com` for SSL.

</details>

---

## Configuration

Create `.env` in root (optional — only needed for SMTP):

```env
PORT=4500
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password        # Google App Password, not account password
SMTP_FROM=your_email@gmail.com
HEADLESS=false                     # Set true for VPS/Docker (no GUI)
```

> **Gmail App Password:** Google Account → Security → 2-Step Verification → App Passwords → Generate for "Mail"

---

## Platform Support

| Platform | Browser Mode | CAPTCHA |
|----------|-------------|---------|
| Windows / macOS / Linux (Desktop) | Visible | Manual solve |
| Docker / VPS | Headless | Not supported |
| Termux (Android) | Headless | Not supported |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/search/launch-browser` | Launch browser |
| `POST` | `/api/search/start` | Start dork search |
| `GET` | `/api/search/progress/:id` | Get search progress |
| `POST` | `/api/search/stop/:id` | Stop search |
| `GET` | `/api/search/export/:id` | Export CSV |
| `POST` | `/api/email/send` | Send bulk emails |
| `GET` | `/api/email/templates` | Get email templates |

---

## Disclaimer

This tool is for **authorized security research** and **responsible disclosure** only. It performs Google dorking and pattern matching — **not AI-powered**, no guarantee of accuracy. Always verify results manually before sending reports. Users must comply with Google's ToS, applicable laws, and each organization's disclosure policy.

---

## License

MIT — see [LICENSE](LICENSE)

<div align="center">

**[Report Bug](https://github.com/Sw4pn33/Easy-Hunt/issues) · [Request Feature](https://github.com/Sw4pn33/Easy-Hunt/issues)**

</div>
