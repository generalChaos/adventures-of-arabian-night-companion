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

test.describe("encounter spike", () => {
  test("draw → determine → react → gain status → undo", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    test.setTimeout(120_000);
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

    await host.getByTestId("draw-encounter").click();
    await expect(host.getByTestId("encounter-panel")).toBeVisible({
      timeout: 15_000,
    });
    await expect(guest.getByTestId("encounter-panel")).toBeVisible({
      timeout: 20_000,
    });

    // Before reaction, guest must not see a paragraph number.
    await expect(guest.getByTestId("paragraph-number")).toHaveCount(0);

    await host.getByTestId("determine-encounter").click();
    await expect(host.getByText(/Roll \d →/)).toBeVisible({ timeout: 15_000 });

    await host.getByTestId("reaction-AID").click();
    await expect(host.getByTestId("paragraph-number")).toBeVisible({
      timeout: 15_000,
    });
    await expect(guest.getByTestId("paragraph-number")).toBeVisible({
      timeout: 20_000,
    });

    await host.getByTestId("gain-sultan").click();
    await expect(host.locator("aside").getByText("Sultan", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(guest.locator("aside").getByText("Sultan", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await host.getByTestId("undo-action").click();
    await expect(host.locator("aside").getByText("Sultan", { exact: true })).toHaveCount(0, {
      timeout: 15_000,
    });

    await host.getByTestId("complete-encounter").click();
    await expect(host.getByTestId("encounter-panel")).toHaveCount(0, {
      timeout: 15_000,
    });

    await hostContext.close();
    await guestContext.close();
  });
});
