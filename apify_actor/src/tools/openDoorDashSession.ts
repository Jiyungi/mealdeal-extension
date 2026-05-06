import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium, type BrowserContext } from "playwright";

const DEFAULT_PROFILE_DIR = "profiles/doordash";
const DEFAULT_START_URL = "https://www.doordash.com/";

async function main(): Promise<void> {
  const profileDir = resolve(
    process.env.MEALDEAL_DOORDASH_USER_DATA_DIR?.trim() || DEFAULT_PROFILE_DIR
  );
  const startUrl = process.env.MEALDEAL_DOORDASH_SESSION_URL?.trim() || DEFAULT_START_URL;

  await mkdir(profileDir, { recursive: true });
  const context = await launchPersistentChrome(profileDir);
  const page = context.pages()[0] ?? (await context.newPage());

  console.log(`DoorDash session profile: ${profileDir}`);
  console.log("A Chrome window is opening. Log in or complete DoorDash verification there.");
  console.log("This tool does not store passwords; it only keeps the local browser profile cookies.");

  await page.goto(startUrl, { waitUntil: "domcontentloaded" });

  const rl = createInterface({ input, output });
  await rl.question("When DoorDash is usable in the browser, press Enter here to save and close...");
  rl.close();

  await context.close();
  console.log("DoorDash browser profile saved.");
}

async function launchPersistentChrome(profileDir: string): Promise<BrowserContext> {
  const channel = process.env.MEALDEAL_BROWSER_CHANNEL?.trim() || "chrome";
  const baseOptions = {
    headless: false,
    viewport: { width: 1365, height: 900 },
    locale: "en-US"
  };

  try {
    return await chromium.launchPersistentContext(profileDir, {
      ...baseOptions,
      channel
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Could not launch Chrome channel "${channel}": ${message}`);
    console.warn("Falling back to Playwright Chromium.");
    return chromium.launchPersistentContext(profileDir, baseOptions);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`DoorDash session setup failed: ${message}`);
  process.exitCode = 1;
});
