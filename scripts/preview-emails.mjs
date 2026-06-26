#!/usr/bin/env node
// Preview every customer/staff email the site sends, BEFORE anything goes live.
//
//   node scripts/preview-emails.mjs                 # render HTML files to ./email-previews/ (no sends)
//   node scripts/preview-emails.mjs --send you@x.com  # ALSO send live [TEST] copies to that inbox
//
// The templates are imported straight from the live Pages Function (functions/api/lead.js), so what
// you preview is byte-for-byte what /api/lead actually renders — previews can never drift.
//
// Live sends use Resend and need RESEND_API_KEY in the environment. They send IMMEDIATELY (no
// scheduled_at) and are prefixed "[TEST]" so they are obvious in the inbox. From defaults to the news
// subdomain; override with PREVIEW_FROM. This sends nothing unless you pass --send.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  customerWelcomeHtml,
  customerBookingHtml,
  customerContactHtml,
  customerNewsletterHtml,
  staffHtml,
} from '../functions/api/lead.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'email-previews');

// A realistic but obviously-fake unsubscribe link so the footer renders (real links are HMAC-signed
// per-recipient at send time by buildUnsubUrl; not needed to preview the layout).
const SAMPLE_UNSUB = 'https://www.menonmedispa.com/api/unsubscribe?e=sample%40example.com&t=preview';

const emails = [
  {
    file: 'welcome.html',
    subject: 'Welcome to Menon Medispa',
    html: customerWelcomeHtml({ firstName: 'Jordan', unsubUrl: SAMPLE_UNSUB }),
  },
  {
    file: 'booking-confirmation.html',
    subject: "We've received your booking request",
    html: customerBookingHtml({
      firstName: 'Jordan',
      service: 'Laser Hair Removal, Brazilian (6-session package, $800)',
      whenStr: 'August 28, 2026 at 2:30 PM EDT',
      price: '$800',
      name: 'Jordan Rivera',
      phone: '(973) 555-0142',
      unsubUrl: SAMPLE_UNSUB,
    }),
  },
  {
    file: 'contact-confirmation.html',
    subject: 'We received your message',
    html: customerContactHtml({ firstName: 'Jordan', unsubUrl: SAMPLE_UNSUB }),
  },
  {
    file: 'newsletter-confirmation.html',
    subject: "You're on the list",
    html: customerNewsletterHtml(SAMPLE_UNSUB),
  },
  {
    file: 'staff-notification.html',
    subject: 'New appointment request: Jordan Rivera',
    html: staffHtml(
      {
        service_interest: 'Laser Hair Removal',
        preferred_date: '2026-08-28',
        preferred_window: '2:30 PM',
        message: 'Looking to start a package, mornings preferred. (No medical details.)',
      },
      { name: 'Jordan Rivera', email: 'jordan@example.com', phone: '(973) 555-0142', type: 'appointment_request', glow: null }
    ),
  },
];

async function renderFiles() {
  await mkdir(OUT, { recursive: true });
  const index = [
    '<!doctype html><meta charset="utf-8"><title>Menon Medispa email previews</title>',
    '<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#2e2a31;">',
    '<h1>Menon Medispa email previews</h1>',
    '<p>Each link opens the exact HTML <code>/api/lead</code> sends.</p><ul>',
  ];
  for (const e of emails) {
    await writeFile(join(OUT, e.file), e.html, 'utf8');
    index.push(`<li><a href="./${e.file}">${e.file}</a> &mdash; subject: <code>${e.subject}</code></li>`);
  }
  index.push('</ul></body>');
  await writeFile(join(OUT, 'index.html'), index.join('\n'), 'utf8');
  console.log(`Rendered ${emails.length} emails + index to ${OUT}`);
  console.log(`Open: ${join(OUT, 'index.html')}`);
}

async function sendLive(to) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error('RESEND_API_KEY is not set, cannot send live test. Files were still rendered.');
    process.exitCode = 1;
    return;
  }
  const from = process.env.PREVIEW_FROM || process.env.NEWSLETTER_FROM || 'Menon Medispa <hello@news.menonmedispa.com>';
  console.log(`Sending ${emails.length} test emails to ${to} from ${from} ...`);
  for (const e of emails) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to, subject: `[TEST] ${e.subject}`, html: e.html }),
      });
      const body = await res.text();
      console.log(`  ${e.file}: ${res.status}${res.ok ? '' : ' ' + body.slice(0, 200)}`);
    } catch (err) {
      console.error(`  ${e.file}: send failed`, err?.message || err);
    }
  }
}

await renderFiles();

const sendIdx = process.argv.indexOf('--send');
if (sendIdx !== -1) {
  const to = process.argv[sendIdx + 1];
  if (!to || to.startsWith('--')) {
    console.error('Usage: node scripts/preview-emails.mjs --send you@example.com');
    process.exitCode = 1;
  } else {
    await sendLive(to);
  }
}
