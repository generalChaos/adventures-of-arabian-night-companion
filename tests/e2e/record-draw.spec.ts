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
}

test.describe("physical record draw", () => {
  test("host records encounter #1 from physical deck", async ({
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

    await host.getByTestId("physical-card-number").fill("1");
    await host.getByTestId("record-draw").click();
    await expect(host.getByTestId("encounter-panel")).toBeVisible({
      timeout: 15_000,
    });
    await expect(guest.getByTestId("encounter-panel")).toBeVisible({
      timeout: 20_000,
    });

    await hostContext.close();
    await guestContext.close();
  });
});
