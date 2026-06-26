/**
 * leadForm.ts — progressive enhancement for any <form> that POSTs to /api/lead.
 *
 * The Cloudflare Pages Function at functions/api/lead.js returns JSON, so a native
 * form submit would navigate the browser to raw JSON. This helper intercepts the
 * submit, sends the fields as JSON, and either reveals an inline success panel
 * ([data-form-success] inside the nearest [data-leadform-root]) or redirects.
 *
 * Contract expected in the markup:
 *   <div data-leadform-root>
 *     <form ...>            ... inputs with `name` attrs (name/email/phone/...) ...
 *       <p data-form-error hidden></p>
 *       <button type="submit">…</button>
 *     </form>
 *     <div data-form-success hidden> confirmation copy </div>
 *   </div>
 *
 * Field names map 1:1 to the endpoint (name, email, phone, service_interest,
 * message, preferred_date, preferred_window, type, consent_email[_text],
 * consent_sms[_text], consent_version, send_confirmation, company_website).
 * source_page is auto-filled from the current path when absent.
 */

const PHONE_DISPLAY = '(973) 494-8431';

export interface EnhanceOptions {
  /** If set, redirect here on success instead of revealing the inline panel. */
  successUrl?: string;
  /** Extra validation run after the built-in name/contact checks. Return an error string or null. */
  validate?: (data: Record<string, string>) => string | null;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const ERROR_COPY: Record<string, string> = {
  missing_contact: 'Please add your name and an email or phone number.',
  bad_email: 'That email address does not look right.',
  bad_request: 'Something went wrong. Please try again.',
  db_unbound: `We could not save that. Please call us at ${PHONE_DISPLAY}.`,
};

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
// Google Ads click ids. gclid is what lets WhatConverts attribute the lead to Google Ads (CPC) and
// upload it back as an offline conversion; gbraid/wbraid cover some iOS traffic.
const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'] as const;

/** First-touch UTMs stashed on landing (see BaseLayout) so a booking made on a
 *  later, UTM-less page still carries the original campaign. */
function firstTouchUtms(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('menonUtm') || '{}') || {};
  } catch {
    return {};
  }
}

/** First-touch Google Ads click ids stashed on landing (see BaseLayout), so a booking made later on a
 *  clean URL still carries the gclid that ties it back to the ad click. */
function firstTouchClickIds(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('menonClickIds') || '{}') || {};
  } catch {
    return {};
  }
}

function readForm(form: HTMLFormElement): Record<string, string> {
  const data: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    data[key] = typeof value === 'string' ? value : '';
  });

  // Safety net: if a split-name form's `name` sync did not run (e.g. submit fired before the input
  // listener populated the hidden field), rebuild it from first/last so the endpoint's name check
  // never rejects an otherwise-complete submission.
  if (!data.name && (data.first_name || data.last_name)) {
    data.name = [data.first_name, data.last_name].filter(Boolean).join(' ').trim();
  }

  // Attribution: prefer UTMs on the current URL, else fall back to the first-touch
  // values captured when the visitor first landed. The /api/lead INSERT already has
  // columns for all five; without this they were always NULL.
  const params = new URLSearchParams(location.search);
  const stored = firstTouchUtms();
  for (const k of UTM_KEYS) {
    const v = params.get(k) || stored[k];
    if (v && !data[k]) data[k] = v;
  }

  // Same first-touch rule for the Google Ads click ids, so /api/lead can hand WhatConverts the gclid.
  const storedClicks = firstTouchClickIds();
  for (const k of CLICK_ID_KEYS) {
    const v = params.get(k) || storedClicks[k];
    if (v && !data[k]) data[k] = v;
  }

  if (!data.source_page) data.source_page = location.pathname + location.search;

  // Find Your Glow: if the visitor completed the quiz earlier in this browser, attach the saved
  // profile so the STAFF notification can show what was recommended and why. lead.js renders it for
  // staff only — it is never stored in our DB or forwarded. Fresh for 30 days. (The quiz's own
  // email-capture posts via a separate fetch and never carries this, so the profile rides along
  // ONLY when the visitor makes a real booking/inquiry afterward.)
  try {
    const rawGlow = localStorage.getItem('menonGlow');
    if (rawGlow && !data.glow_summary) {
      const g = JSON.parse(rawGlow);
      if (g && typeof g.savedAt === 'number' && Date.now() - g.savedAt < 30 * 24 * 60 * 60 * 1000) {
        data.glow_summary = rawGlow;
      }
    }
  } catch {
    /* localStorage unavailable or bad JSON; skip the attachment */
  }

  return data;
}

function showError(el: Element | null, msg: string) {
  if (!el) return;
  el.textContent = msg;
  (el as HTMLElement).hidden = false;
}

function clearError(el: Element | null) {
  if (!el) return;
  el.textContent = '';
  (el as HTMLElement).hidden = true;
}

export function enhanceLeadForm(form: HTMLFormElement, opts: EnhanceOptions = {}): void {
  const root = form.closest('[data-leadform-root]') ?? form.parentElement;
  const errorEl = form.querySelector('[data-form-error]');
  const submitBtn = form.querySelector('[type="submit"]') as HTMLButtonElement | null;

  form.setAttribute('novalidate', '');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm(form);

    // Built-in validation mirrors the endpoint: name + (email OR phone).
    const name = (data.name || '').trim();
    const email = (data.email || '').trim();
    const phone = (data.phone || '').trim();
    let err: string | null = null;
    if (!name) err = 'Please add your name.';
    else if (!email && !phone) err = 'Please add an email or phone number so we can confirm.';
    else if (email && !EMAIL_RE.test(email)) err = 'That email address does not look right.';
    if (!err && opts.validate) err = opts.validate(data);
    if (err) {
      showError(errorEl, err);
      return;
    }
    clearError(errorEl);

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.label = submitBtn.textContent || '';
      submitBtn.textContent = 'Sending…';
    }

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (res.ok && json.ok) {
        // GTM conversion signal. Forms are AJAX (no thank-you page nav), so point the
        // Google Ads conversion trigger in GTM-MSMM2PHT at this custom event.
        try { (window as any).dataLayer = (window as any).dataLayer || []; (window as any).dataLayer.push({ event: 'lead_submit', form_type: data.type || 'lead' }); } catch { /* no-op */ }
        if (opts.successUrl) {
          // Stash a short booking summary so the thank-you page can echo what was requested.
          try {
            if (data.type === 'appointment_request') {
              sessionStorage.setItem('menonBooked', JSON.stringify({
                service: data.service_interest || '',
                date: data.preferred_date || '',
                window: data.preferred_window || '',
              }));
            }
          } catch { /* no-op */ }
          location.href = opts.successUrl;
          return;
        }
        form.hidden = true;
        const success = root?.querySelector('[data-form-success]') as HTMLElement | null;
        if (success) {
          success.hidden = false;
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      showError(errorEl, ERROR_COPY[json.error || 'bad_request'] || ERROR_COPY.bad_request);
    } catch {
      showError(errorEl, `Something went wrong. Please call us at ${PHONE_DISPLAY}.`);
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = submitBtn.dataset.label || 'Submit';
    }
  });
}

/**
 * Newsletter sign-up (email-only): a lighter enhancer for the footer "Are you on the list?" form.
 * Posts { email, type: 'newsletter' } to /api/lead, which adds the consented email straight to the
 * Resend audience. On success it hides the form and reveals the sibling [data-newsletter-msg] note.
 * Separate from enhanceLeadForm because that one requires a name; a newsletter signup is email-only.
 */
export function enhanceNewsletterForm(form: HTMLFormElement, opts: { onSuccess?: () => void } = {}): void {
  const input = form.querySelector('input[name="email"]') as HTMLInputElement | null;
  const btn = form.querySelector('[type="submit"]') as HTMLButtonElement | null;
  const msg = form.parentElement?.querySelector('[data-newsletter-msg]') as HTMLElement | null;
  form.setAttribute('novalidate', '');

  const show = (text: string, ok: boolean) => {
    if (!msg) return;
    msg.textContent = text;
    msg.hidden = false;
    msg.dataset.state = ok ? 'ok' : 'error';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (input?.value || '').trim();
    if (!EMAIL_RE.test(email)) {
      show('Please enter a valid email address.', false);
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.dataset.label = btn.textContent || '';
      btn.textContent = 'Joining…';
    }
    const hp = (form.querySelector('input[name="company_website"]') as HTMLInputElement | null)?.value || '';
    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          type: 'newsletter',
          source_page: location.pathname + location.search,
          company_website: hp,
          ...firstTouchUtms(),
        }),
      });
      const json = await res.json().catch(() => ({} as { ok?: boolean; error?: string }));
      if (res.ok && json.ok) {
        // GTM conversion signal for the newsletter sign-up (see lead_submit note above).
        try { (window as any).dataLayer = (window as any).dataLayer || []; (window as any).dataLayer.push({ event: 'newsletter_signup' }); } catch { /* no-op */ }
        form.hidden = true;
        show("You're on the list. Watch your inbox for offers and skincare tips.", true);
        try { opts.onSuccess?.(); } catch { /* no-op */ }
        return;
      }
      show(ERROR_COPY[json.error || 'bad_request'] || ERROR_COPY.bad_request, false);
    } catch {
      show(`Something went wrong. Please call us at ${PHONE_DISPLAY}.`, false);
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || 'Submit';
    }
  });
}
