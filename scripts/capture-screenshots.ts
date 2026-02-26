/**
 * Capture README screenshots from hexcore preview pages.
 *
 * Prerequisites:
 *   1. Start the hexcore web dev server:  cd hexcore/web && npm run dev
 *   2. Run:  npx tsx hexdeck/scripts/capture-screenshots.ts
 *
 * Outputs PNGs to hexdeck/.github/assets/
 */

import { chromium } from "playwright";
import path from "path";

const BASE = "http://localhost:3000/preview";
const OUT = path.resolve(__dirname, "../.github/assets");

interface Shot {
  name: string;
  url: string;
  width: number;
  selector: string;
  wait?: number;
}

const shots: Shot[] = [
  {
    name: "dashboard.png",
    url: `${BASE}/dashboard`,
    width: 1200,
    selector: '[data-screenshot="dashboard"]',
    wait: 2000,
  },
  {
    name: "sessions.png",
    url: `${BASE}/sessions`,
    width: 800,
    selector: '[data-screenshot="sessions"]',
    wait: 1000,
  },
  {
    name: "widget.png",
    url: `${BASE}/widget`,
    width: 1200,
    selector: '[data-screenshot="widget"]',
    wait: 2000,
  },
  {
    name: "relay.png",
    url: `${BASE}/relay`,
    width: 800,
    selector: '[data-screenshot="relay"]',
    wait: 1000,
  },
];

async function main() {
  const browser = await chromium.launch();

  for (const shot of shots) {
    console.log(`Capturing ${shot.name} from ${shot.url}`);
    const page = await browser.newPage({
      viewport: { width: shot.width, height: 900 },
      deviceScaleFactor: 2,
    });

    await page.goto(shot.url, { waitUntil: "networkidle" });
    if (shot.wait) await page.waitForTimeout(shot.wait);

    const el = await page.$(shot.selector);
    if (!el) {
      console.warn(`  selector ${shot.selector} not found, using full page`);
      await page.screenshot({ path: path.join(OUT, shot.name), type: "png" });
    } else {
      await el.screenshot({ path: path.join(OUT, shot.name), type: "png" });
    }

    await page.close();
    console.log(`  saved ${shot.name}`);
  }

  await browser.close();
  console.log(`\nDone — images in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
