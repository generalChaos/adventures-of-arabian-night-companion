import { test, expect, type Browser, type Page } from "@playwright/test";

async function createGame(page: Page, name: string) {
  await page.goto("/");
  const nameInput = page.locator("#name");
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await nameInput.click();
  await nameInput.fill(name);
  const createBtn = page.getByRole("button", { name: /Create game/i });
  await expect(createBtn).toBeEnabled({ timeout: 10_000 });
  await createBtn.click();
  await expect(page).toHaveURL(/\/game\//, { timeout: 30_000 });
  const codeText = await page.locator("header").getByText(/Code /).textContent();
  const match = codeText?.match(/Code\s+([A-Z0-9]+)/);
  expect(match?.[1]).toBeTruthy();
  return match![1]!;
}

async function joinGame(page: Page, name: string, code: string) {
  await page.goto("/");
  const nameInput = page.locator("#name");
  await expect(nameInput).toBeVisible({ timeout: 15_000 });
  await nameInput.fill(name);
  await page.locator("#code").fill(code);
  const joinBtn = page.getByRole("button", { name: /^Join$/i });
  await expect(joinBtn).toBeEnabled({ timeout: 10_000 });
  await joinBtn.click();
  await expect(page).toHaveURL(/\/game\//, { timeout: 30_000 });
}

test.describe("lobby + turn flow", () => {
  test("character select, start, end turn hands off", async ({
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

    await host.getByTestId("character-sinbad").click();
    await expect(host.getByTestId("character-sinbad")).toBeVisible();
    await guest.getByTestId("character-ali_baba").click();

    await host.getByRole("button", { name: /Start Game/i }).click();
    await expect(host.getByText(/Your turn/)).toBeVisible({ timeout: 15_000 });
    await expect(host.getByTestId("board-viewport")).toBeVisible();

    await host.getByTestId("end-turn").click();
    await expect(guest.getByText(/Your turn/)).toBeVisible({ timeout: 20_000 });
    await expect(host.getByText(/Your turn/)).toHaveCount(0);

    await hostContext.close();
    await guestContext.close();
  });
});
