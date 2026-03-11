const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.post('/send', async (req, res) => {
  const { emails, subject, body, fromName } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'No emails provided' });
  }
  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and body are required' });
  }

  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  };

  if (!smtpConfig.auth.user || smtpConfig.auth.user === 'your_email@gmail.com') {
    return res.status(400).json({ error: 'SMTP not configured. Update .env file with your email credentials.' });
  }

  let transporter;
  try {
    transporter = nodemailer.createTransport(smtpConfig);
    await transporter.verify();
  } catch (err) {
    return res.status(500).json({ error: `SMTP connection failed: ${err.message}` });
  }

  const results = [];
  const senderName = fromName || 'Security Researcher';

  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: `"${senderName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: email,
        subject: subject,
        text: body,
        html: body.replace(/\n/g, '<br>'),
      });
      results.push({ email, status: 'sent' });
    } catch (err) {
      results.push({ email, status: 'failed', error: err.message });
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  const sent = results.filter(r => r.status === 'sent').length;
  const failed = results.filter(r => r.status === 'failed').length;

  res.json({ success: true, sent, failed, total: emails.length, results });
});

router.get('/templates', (req, res) => {
  res.json({
    success: true,
    templates: [
      {
        id: 'initial_report',
        name: 'Initial Vulnerability Report',
        subject: 'Security Vulnerability Report - [DOMAIN]',
        body: `Hello Security Team,

I am a security researcher and I have identified a potential security vulnerability on your platform.

**Vulnerability Type:** [TYPE]
**Severity:** [LOW/MEDIUM/HIGH/CRITICAL]
**Affected URL/Endpoint:** [URL]

**Description:**
[Detailed description of the vulnerability]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Impact:**
[Describe the potential impact]

**Recommendation:**
[Suggested fix]

I am reporting this in accordance with your responsible disclosure policy. I have not shared this information with any third party and will not disclose it publicly until a fix has been implemented.

Please let me know if you need any additional information.

Best regards,
[YOUR NAME]
Security Researcher`,
      },
      {
        id: 'follow_up',
        name: 'Follow-up Report',
        subject: 'Follow-up: Security Vulnerability Report - [DOMAIN]',
        body: `Hello Security Team,

I am following up on my previous security vulnerability report sent on [DATE].

I wanted to check if you have had a chance to review the reported vulnerability. I am happy to provide any additional information or clarification needed.

The vulnerability details:
- Type: [TYPE]
- Affected URL: [URL]

Looking forward to your response.

Best regards,
[YOUR NAME]
Security Researcher`,
      },
      {
        id: 'ask_vdp',
        name: 'Ask About VDP',
        subject: 'Security Vulnerability Disclosure Inquiry - [DOMAIN]',
        body: `Hello,

I am a security researcher and I have potentially identified a security issue on your platform. However, I could not find a formal vulnerability disclosure policy or security contact on your website.

Could you please direct me to:
1. Your vulnerability disclosure policy (if one exists)
2. The appropriate security contact or email to report vulnerabilities
3. Any bug bounty or responsible disclosure program details

I want to ensure I follow the proper channels for responsible disclosure.

Thank you for your time.

Best regards,
[YOUR NAME]
Security Researcher`,
      },
    ],
  });
});

module.exports = router;
