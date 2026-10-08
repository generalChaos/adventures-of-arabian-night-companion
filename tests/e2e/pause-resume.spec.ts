import { test, expect, type Browser, type Page } from "@playwright/test";

async function createGame(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: /Create game/i }).click();
  await expect(page).toHaveURL(/\/game\//, { timeout: 30_000 });
  const codeText = await page.locator("header").getByText(/Code /).textContent();
  const match = codeText?.match(/Code\s+([A-Z0-9]+)/);
  expect(match?.[1]).toBeTruthy();
  return match![1]!;
}

async function joinGame(page: Page, name: string, code: string) {
  await page.goto("/");
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Join code").fill(code);
  await page.getByRole("button", { name: /^Join$/i }).click();
  await expect(page).toHaveURL(/\/game\//, { timeout: 30_000 });
  await expect(page.locator("aside").getByText(new RegExp(name))).toBeVisible();
}

test.describe("pause / resume", () => {
  test("host pauses and resumes; guest sees status", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(90_000);
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();

    const code = await createGame(host, "Rico");
    await joinGame(guest, "Sarah", code);
    await expect(host.locator("aside").getByText(/Sarah/)).toBeVisible({
      timeout: 15_000,
    });

    await host.getByRole("button", { name: /Start Game/i }).click();
    await expect(host.getByText(/Your turn/)).toBeVisible({ timeout: 15_000 });

    await host.getByTestId("pause-game").click();
    await expect(host.getByText("PAUSED", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(guest.getByText("PAUSED", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await host.getByTestId("resume-game").click();
    await expect(host.getByText("ACTIVE", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(guest.getByText("ACTIVE", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await hostContext.close();
    await guestContext.close();
  });
});
