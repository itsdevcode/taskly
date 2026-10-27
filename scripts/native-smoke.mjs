// Optional Windows smoke test against the built WebView2 executable.
// Requires WebView2 remote debugging, which is enabled only for this process.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const binary = resolve(
  process.argv[2] ?? "src-tauri/target/release/taskly.exe",
);
const title = `Taskly smoke ${Date.now()}`;
let processHandle;
let browser;
async function launch() {
  processHandle = spawn(binary, [], {
    windowsHide: true,
    stdio: "ignore",
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: "--remote-debugging-port=9223",
    },
  });
  processHandle.on("error", (error) => console.error(error));
  for (let attempts = 0; attempts < 60; attempts++) {
    try {
      browser = await chromium.connectOverCDP("http://127.0.0.1:9223");
      break;
    } catch {
      await delay(500);
    }
  }
  if (!browser)
    throw new Error(
      "Could not connect to Taskly WebView2. Build it first with pnpm tauri build.",
    );
  const context = browser.contexts()[0];
  for (let attempts = 0; attempts < 30; attempts++) {
    const page = context
      .pages()
      .find((page) => !page.url().startsWith("devtools:"));
    if (page) {
      await page.getByRole("heading", { name: /All Tasks/ }).waitFor();
      return page;
    }
    await delay(500);
  }
  throw new Error("Taskly page did not become ready.");
}
async function stop() {
  if (browser) {
    await browser.close();
    browser = undefined;
  }
  if (processHandle && processHandle.exitCode === null) {
    processHandle.kill();
    await delay(1000);
  }
}
try {
  let page = await launch();
  await page
    .getByRole("button", { name: "Add task", exact: false })
    .first()
    .click();
  await page.getByLabel("Task title").fill(title);
  await page
    .getByLabel("Description")
    .fill("Temporary native SQLite smoke test.");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByText(title, { exact: true }).waitFor();
  await mkdir("artifacts", { recursive: true });
  await page.screenshot({ path: "artifacts/native-workspace.png" });
  await stop();
  page = await launch();
  await page.getByText(title, { exact: true }).waitFor();
  await page
    .getByRole("button", { name: `Complete ${title}`, exact: true })
    .click();
  await page
    .getByRole("button", { name: `Reopen ${title}`, exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: `Delete ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await page.getByText(title, { exact: true }).waitFor({ state: "detached" });
  console.log(
    "Native WebView2 / Rust IPC / SQLite CRUD and restart persistence passed.",
  );
} finally {
  await stop();
}
