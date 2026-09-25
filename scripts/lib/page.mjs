import sharp from 'sharp';

// Common consent-platform containers. Hidden with CSS and, if they fight back with inline styles, removed.
const CONSENT = [
  '#onetrust-consent-sdk', '#onetrust-banner-sdk', '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay',
  '.fc-consent-root', '.fc-dialog-overlay', '#qc-cmp2-container', '.cc-window', '.cc-banner', '#usercentrics-root',
  '#cmpbox', '#cmpbox2', '.cookie-banner', '.cookie-consent', '.cookie-notice', '#cookie-banner', '#cookie-consent',
  '#cookie-notice', '#cookiescript_injected', '.osano-cm-window', '#truste-consent-track', '.truste_box_overlay',
  '#didomi-host', '#hs-eu-cookie-confirmation', '.termly-styles-root', '[aria-label="cookieconsent"]',
  '#cookie_consent_popup', '.cky-consent-container', '.cky-overlay', '#moove_gdpr_cookie_info_bar',
  '#cmplz-cookiebanner-container', '#cookiePrefPopup',
].join(', ');

// Ad slots. Ad scripts set inline `!important` styles that CSS can't override, so these are removed from the DOM.
const ADS = 'ins.adsbygoogle, [id^="aswift_"], .google-auto-placed, [id^="google_ads_iframe"], [id^="div-gpt-ad"], iframe[src*="doubleclick.net"], iframe[src*="googlesyndication"]';

// Hide consent layers and scrollbars. Animations are fast-forwarded by Playwright's `animations: 'disabled'`.
const STABILIZE_CSS = `
  *, *::before, *::after { caret-color: transparent !important; }
  html { scrollbar-width: none !important; }
  ::-webkit-scrollbar { display: none !important; }
  html body :is(${CONSENT}) { display: none !important; }
`;

// Only ever decline: never accept tracking on the user's behalf.
const REJECT_BUTTON = /^\s*(reject|reject all|reject all cookies|decline|decline all|deny|deny all|do not consent|only necessary|necessary only|use necessary cookies only|essential cookies only)\s*$/i;

const CHALLENGE_TEXT = /just a moment|attention required|verify you are human|checking your browser|are you a robot|access denied|enable javascript and cookies|request blocked|captcha/i;

const host = (u) => new URL(u).hostname.replace(/^www\./, '');

async function dismissConsent(page, extraClicks = []) {
  for (const selector of extraClicks) {
    await page.locator(selector).first().click({ timeout: 1500 }).catch(() => {});
  }
  for (const frame of page.frames()) {
    const button = frame.getByRole('button', { name: REJECT_BUTTON }).first();
    if (await button.isVisible().catch(() => false)) await button.click({ timeout: 1500 }).catch(() => {});
  }
}

/** Download a fixed image (e.g. a YouTube thumbnail) instead of screenshotting a page. */
export async function fetchImage(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return { ok: false, retry: res.status >= 500, reason: `HTTP ${res.status}` };
    return { ok: true, png: await sharp(Buffer.from(await res.arrayBuffer())).png().toBuffer() };
  } catch (err) {
    return { ok: false, retry: true, reason: err.message.slice(0, 120) };
  }
}

/**
 * Load a page in a fresh browser context and take a viewport screenshot.
 * Returns { ok: true, png } or { ok: false, retry, reason }. Never tries to get past bot challenges.
 * `retry` is false for failures that won't change a few seconds later (4xx, challenges, redirects).
 */
export async function capturePage(browser, entry, defaults) {
  const shot = entry.shot;
  const target = shot.captureUrl ?? entry.url;
  // A context per page: no cookies or consent state leak between sites captured in parallel.
  // bypassCSP only lets our own style tag in on sites with strict CSPs.
  const context = await browser.newContext({
    viewport: defaults.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
    bypassCSP: true,
  });
  try {
    const page = await context.newPage();
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const status = response?.status() ?? 0;
    if (status >= 400) return { ok: false, retry: status >= 500, reason: `HTTP ${status}` };

    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});

    if (!shot.allowRedirect && host(page.url()) !== host(target))
      return { ok: false, retry: false, reason: `redirected to ${host(page.url())}` };

    const title = await page.title().catch(() => '');
    const text = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? '').catch(() => '');
    const challengeFrame = await page.locator('iframe[src*="challenges.cloudflare.com"], #challenge-form, #cf-challenge-running').count();
    if (CHALLENGE_TEXT.test(title) || challengeFrame || (text.length < 400 && CHALLENGE_TEXT.test(text)))
      return { ok: false, retry: false, reason: `bot challenge ("${title.slice(0, 40)}")` };

    await dismissConsent(page, shot.click);
    const hide = (shot.hide ?? []).map((s) => `${s}{display:none!important}`).join('\n');
    await page.addStyleTag({ content: STABILIZE_CSS + hide + (shot.css ?? '') });
    await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY ?? 0);
    await page.waitForTimeout(shot.waitMs ?? defaults.waitMs ?? 1500);
    // Give images on screen (including lazy ones) a few seconds to finish loading.
    await page.evaluate(() => {
      const onScreen = [...document.images].filter((img) => img.getBoundingClientRect().top < innerHeight);
      onScreen.forEach((img) => { img.loading = 'eager'; });
      const loaded = onScreen.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
      return Promise.race([Promise.all(loaded), new Promise((r) => setTimeout(r, 5000))]);
    }).catch(() => {});
    // Pause hero videos so the frame we grab depends less on playback timing, and drop ad slots.
    await page.evaluate((overlays) => {
      document.querySelectorAll('video').forEach((v) => v.pause());
      document.querySelectorAll(overlays).forEach((el) => el.remove());
    }, `${ADS}, ${CONSENT}`).catch(() => {});

    const png = await page.screenshot({ clip: shot.clip, animations: 'disabled', timeout: 20_000 });
    const { channels } = await sharp(png).stats();
    const spread = channels.slice(0, 3).reduce((sum, c) => sum + c.stdev, 0) / 3;
    if (spread < 3) return { ok: false, retry: true, reason: 'blank page' };

    return { ok: true, png };
  } catch (err) {
    return { ok: false, retry: true, reason: err.message.split('\n')[0].slice(0, 120) };
  } finally {
    await context.close().catch(() => {});
  }
}
