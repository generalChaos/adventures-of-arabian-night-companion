import { test, expect } from "@playwright/test";

test("home page renders brand", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Adventures of the Tales of Arabian Nights/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Create game/i })).toBeVisible();
});

test("health endpoint reports service", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.service).toBe("atan-companion-app");
});
