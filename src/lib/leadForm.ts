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

function readForm(form: HTMLFormElement): Record<string, string> {
  const data: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    data[key] = typeof value === 'string' ? value : '';
  });
  if (!data.source_page) data.source_page = location.pathname;
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
        if (opts.successUrl) {
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
