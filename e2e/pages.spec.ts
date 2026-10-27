import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isTauri", { value: true });
    const read = (): Record<string, unknown>[] =>
      JSON.parse(localStorage.getItem("test-pages") || "[]");
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {
        metadata: { currentWindow: { label: "main" } },
        transformCallback: () => 0,
        invoke: async (
          command: string,
          args: { id?: string; input?: Record<string, unknown> } = {},
        ) => {
          if (command === "list_tasks") return [];
          if (command.startsWith("plugin:event|")) return 1;
          let pages = read();
          const now = new Date().toISOString();
          if (command === "list_pages") return pages;
          if (command === "create_page") {
            const result = {
              id: crypto.randomUUID(),
              ...args.input,
              createdAt: now,
              updatedAt: now,
            };
            pages.push(result);
            localStorage.setItem("test-pages", JSON.stringify(pages));
            return result;
          }
          const index = pages.findIndex((p) => p.id === args.id);
          if (index < 0) throw { message: "Page missing" };
          if (command === "update_page") {
            if (localStorage.getItem("fail-save"))
              throw { message: "Could not save this page" };
            await new Promise((resolve) => setTimeout(resolve, 150));
            pages = read();
            const updatedIndex = pages.findIndex((p) => p.id === args.id);
            Object.assign(pages[updatedIndex], args.input, { updatedAt: now });
            localStorage.setItem("test-pages", JSON.stringify(pages));
            return pages[updatedIndex];
          }
          if (command === "delete_page") {
            pages.splice(index, 1);
            localStorage.setItem("test-pages", JSON.stringify(pages));
            return;
          }
          throw new Error(`Unexpected command ${command}`);
        },
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Pages \d/ }).click();
});
test("creates block notes, autosaves, searches, reloads and deletes with confirmation", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await page.getByLabel("Page title").fill("My project notes");
  await page
    .getByLabel("Block 1 type", { exact: true })
    .selectOption("heading");
  await page
    .getByLabel("Heading block 1", { exact: true })
    .fill("A clear plan");
  await page.getByLabel("Heading block 1", { exact: true }).press("Enter");
  await page
    .getByLabel("Block 2 type", { exact: true })
    .selectOption("checklist");
  await page
    .getByLabel("Checklist block 2", { exact: true })
    .fill("Write the first draft");
  await page.getByLabel("Check item 2", { exact: true }).check();
  await expect(page.locator(".save-state")).toHaveText("Saved on this device");
  await page.screenshot({
    path: "artifacts/pages-workspace.png",
    animations: "disabled",
  });
  await page.getByLabel("Search pages").fill("FIRST DRAFT");
  await expect(
    page.getByRole("button", { name: /My project notes/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Pages \d/ }).click();
  await page.getByRole("button", { name: /My project notes/ }).click();
  await expect(page.getByLabel("Check item 2", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Heading block 1", { exact: true })).toHaveValue(
    "A clear plan",
  );
  await page.getByRole("button", { name: "Delete page", exact: true }).click();
  await page.getByRole("button", { name: "Keep page" }).click();
  await expect(page.getByLabel("Page title")).toHaveValue("My project notes");
  await page.getByRole("button", { name: "Delete page", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete page", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A home for your next idea." }),
  ).toBeVisible();
});
test("keeps unsaved edits after a failure and saves them before changing pages", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await page.evaluate(() => localStorage.setItem("fail-save", "true"));
  await page.getByLabel("Page title").fill("Keep this idea");
  await expect(page.getByRole("alert")).toContainText(
    "Could not save this page",
  );
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await expect(page.getByLabel("Page title")).toHaveValue("Keep this idea");
  await page.evaluate(() => localStorage.removeItem("fail-save"));
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".save-state")).toHaveText("Saved on this device");
  await page
    .getByLabel("Text block 1", { exact: true })
    .fill("An edit in flight");
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await expect(page.getByLabel("Page title")).toHaveValue("Untitled");
  await page.getByRole("button", { name: /Keep this idea/ }).click();
  await expect(page.getByLabel("Text block 1", { exact: true })).toHaveValue(
    "An edit in flight",
  );
  await page.getByRole("button", { name: /^Pending \d/ }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all clear for now" }),
  ).toBeVisible();
});
test("saves edits made while an earlier save is in flight", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New page", exact: true }).click();
  await page.getByLabel("Text block 1", { exact: true }).fill("First revision");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page
    .getByLabel("Text block 1", { exact: true })
    .fill("Latest revision");
  await expect(page.locator(".save-state")).toHaveText("Saved on this device");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("test-pages") || "[]"),
  );
  expect(stored[0].blocks[0].text).toBe("Latest revision");
  await page.setViewportSize({ width: 720, height: 540 });
  await expect(
    page.getByRole("button", { name: "Pages", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
