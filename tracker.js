/**
 * Teams Attendance Tracker
 *
 * Joins a Microsoft Teams meeting as a guest and monitors the participant
 * roster to log when "Santhosh" joins or leaves the call.
 *
 * Usage:
 *   MEETING_URL=<teams-link> node tracker.js
 *
 * Output:
 *   attendance_log.csv  — appended with ISO timestamp, event, and name
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const MEETING_URL = process.env.MEETING_URL || 'https://teams.microsoft.com/l/meetup-join/PLACEHOLDER';
const TARGET_NAME = 'Santhosh';
const LOG_FILE = path.join(__dirname, 'attendance_log.csv');
const LOBBY_TIMEOUT_MS = 120_000; // 2 minutes to be admitted from the lobby
const POLL_INTERVAL_MS = 10_000;  // check the roster every 10 seconds
const BOT_DISPLAY_NAME = '.';     // subtle guest name shown to other participants

// ---------------------------------------------------------------------------
// CSV logging helper
// ---------------------------------------------------------------------------
function appendLog(event) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp},${event},${TARGET_NAME}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf8');
  console.log(`[LOG] ${line.trim()}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('[INFO] Launching browser…');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    permissions: ['camera', 'microphone'],
  });

  const page = await context.newPage();

  try {
    // -----------------------------------------------------------------------
    // Step 1 – Navigate to the meeting URL
    // -----------------------------------------------------------------------
    console.log(`[INFO] Navigating to meeting URL…`);
    await page.goto(MEETING_URL, { waitUntil: 'domcontentloaded' });

    // -----------------------------------------------------------------------
    // Step 2 – Continue on this browser (skip the "open app" prompt)
    // -----------------------------------------------------------------------
    console.log('[INFO] Clicking "Continue on this browser"…');
    await page.waitForSelector('[data-tid="joinOnWeb"]', { timeout: 30_000 });
    await page.click('[data-tid="joinOnWeb"]');

    // -----------------------------------------------------------------------
    // Step 3 – Fill in the guest name and join
    // -----------------------------------------------------------------------
    console.log('[INFO] Entering guest name…');
    await page.waitForSelector('input[placeholder="Enter name"]', { timeout: 30_000 });
    await page.fill('input[placeholder="Enter name"]', BOT_DISPLAY_NAME);

    console.log('[INFO] Clicking join button…');
    await page.waitForSelector('[data-tid="prejoin-join-button"]', { timeout: 10_000 });
    await page.click('[data-tid="prejoin-join-button"]');

    // -----------------------------------------------------------------------
    // Step 4 – Wait in the lobby until the host admits the bot
    // -----------------------------------------------------------------------
    console.log(`[INFO] Waiting in lobby (up to ${LOBBY_TIMEOUT_MS / 1000}s)…`);
    await page.waitForSelector('[data-tid="roster-btn"]', { timeout: LOBBY_TIMEOUT_MS });
    console.log('[INFO] Admitted to the meeting.');

    // -----------------------------------------------------------------------
    // Step 5 – Open the participant roster
    // -----------------------------------------------------------------------
    console.log('[INFO] Opening participant roster…');
    await page.click('[data-tid="roster-btn"]');

    // -----------------------------------------------------------------------
    // Step 6 – Poll the roster and track state changes
    // -----------------------------------------------------------------------
    let targetPresent = false;

    console.log(`[INFO] Monitoring roster for "${TARGET_NAME}" every ${POLL_INTERVAL_MS / 1000}s…`);

    const intervalId = setInterval(async () => {
      try {
        // Read the full text content of the roster panel
        const rosterText = await page.evaluate(() => {
          const roster = document.querySelector('[data-tid="roster-panel"]')
            || document.querySelector('[aria-label="Participants"]')
            || document.querySelector('[data-tid="people-pane-open"]');
          return roster ? roster.innerText : '';
        });

        const isPresent = new RegExp(`\\b${TARGET_NAME}\\b`, 'i').test(rosterText);

        if (isPresent && !targetPresent) {
          targetPresent = true;
          appendLog('Joined');
        } else if (!isPresent && targetPresent) {
          targetPresent = false;
          appendLog('Left');
        }
      } catch (err) {
        console.warn('[WARN] Error reading roster:', err.message);
      }
    }, POLL_INTERVAL_MS);

    // Keep the process alive until the meeting ends (page closes / browser
    // is disconnected) or a SIGINT/SIGTERM signal is received.
    const shutdown = async (signal) => {
      console.log(`[INFO] Received ${signal}. Shutting down…`);
      clearInterval(intervalId);
      await browser.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Wait for the page to be closed externally (meeting ended by host).
    page.on('close', async () => {
      console.log('[INFO] Meeting page closed. Shutting down…');
      clearInterval(intervalId);
      await browser.close();
      process.exit(0);
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
    await browser.close();
    process.exit(1);
  }
})();
