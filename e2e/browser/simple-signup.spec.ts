import { test, expect } from "@playwright/test";
import { setTimeout } from "timers/promises";

const DOMAIN = process.env.DOMAIN || "u-at-proto.work";
const PARTITION = process.env.PARTITION || "local";
const BASE_URL = `https://social.${PARTITION}.${DOMAIN}`;
const PDS_URL = `pds.${PARTITION}.${DOMAIN}`;

test("simple signup test", async ({ page }) => {
  await page.goto(BASE_URL);

  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Bluesky Social" }).click();
  await page.getByRole("radio", { name: "Custom" }).click();
  await page.getByRole("textbox", { name: "Server address" }).fill(PDS_URL);
  await page.getByRole("button", { name: "Done" }).click();

  const testId = Date.now();
  await page
    .getByRole("textbox", { name: /enter.*email/i })
    .fill(`test${testId}@test.com`);
  await page
    .getByRole("textbox", { name: /choose.*password/i })
    .fill("TestPassword123!");
  await page.getByRole("button", { name: "Next" }).click();

  await page
    .getByRole("textbox", { name: new RegExp(`\\.${PDS_URL}`) })
    .fill(`test${testId}`);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText('Give your profile a face')).toBeVisible();

  await page.getByRole("button", { name: /continue|skip/i }).click();
  await expect(page.getByText('What are your interests?')).toBeVisible();

  await page.getByRole("button", { name: /continue|skip/i }).click();
  await expect(page.getByText('Suggested for you')).toBeVisible();
  await page.getByRole("button", { name: /continue|skip/i }).click();

  await expect(page.getByText(/what.*hot/i)).toBeVisible();
});
