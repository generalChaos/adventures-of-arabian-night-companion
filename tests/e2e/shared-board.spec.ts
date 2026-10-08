import { test, expect, type Browser, type Page } from "@playwright/test";

async function createGame(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Display name").fill(name);
  await page.getByRole("button", { name: /Create game/i }).click();
  await expect(page).toHaveURL(/\/game\//, { timeout: 30_000 });
  await expect(page.locator("header").getByText(/Code /)).toBeVisible();
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

test.describe("shared board spike", () => {
  test("host creates, guest joins, host starts, host moves", async ({
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
    await expect(host.getByText(/Turn:/)).toBeVisible({ timeout: 15_000 });
    await expect(guest.getByText(/Turn:/)).toBeVisible({ timeout: 15_000 });

    await expect(host.getByText(/Your turn/)).toBeVisible({ timeout: 15_000 });
    await host.getByTestId("location-damascus").locator("circle").first().click();
    await expect(host.getByText(/Move Rico to Damascus/)).toBeVisible({
      timeout: 10_000,
    });
    await host.getByRole("button", { name: /^Move$/i }).click();

    await expect(host.locator("aside").getByText(/Rico.*Damascus/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(guest.locator("aside").getByText(/Rico.*Damascus/)).toBeVisible({
      timeout: 20_000,
    });

    await host.reload();
    await expect(host.locator("aside").getByText(/Rico.*Damascus/)).toBeVisible({
      timeout: 20_000,
    });

    await hostContext.close();
    await guestContext.close();
  });
});
