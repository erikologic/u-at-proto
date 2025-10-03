import { test, expect, Page } from "@playwright/test";
import { setTimeout } from "timers/promises";

const DOMAIN = process.env.DOMAIN || "u-at-proto.work";
const PARTITION = process.env.PARTITION || "local";
const BASE_URL = `https://social.${PARTITION}.${DOMAIN}`;
const PDS_URL = `pds.${PARTITION}.${DOMAIN}`;

function uniqueId() {
  return Date.now().toString();
}

async function signUp(page: Page, name: string, pdsUrl: string) {
  await page.getByRole("button", { name: "Create account" }).click();

  await page.getByRole("button", { name: "Bluesky Social" }).click();
  await page.getByRole("radio", { name: "Custom" }).click();

  await page.getByRole("textbox", { name: "Server address" }).fill(pdsUrl);
  await page.getByRole("button", { name: "Done" }).click();

  const email = `${name}@test.com`;
  const password = "TestPassword123!";
  await page.getByRole("textbox", { name: /enter.*email/i }).fill(email);
  await page.getByRole("textbox", { name: /choose.*password/i }).fill(password);
  await page.getByRole("button", { name: "Next" }).click();

  await page
    .getByRole("textbox", { name: new RegExp(`\\.${pdsUrl}`) })
    .fill(name);
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Give your profile a face")).toBeVisible();
  await page.getByRole("button", { name: /continue|skip/i }).click();

  await expect(page.getByText("What are your interests?")).toBeVisible();
  await page.getByRole("button", { name: /continue|skip/i }).click();

  try {
    await expect(
      page.getByText(/Suggested for you|Free your feed/)
    ).toBeVisible();
    await page.getByRole("button", { name: /continue|skip/i }).click();
  } catch {
    await expect(page.getByText(/You're ready to go!/)).toBeVisible();
    await page.getByText(/let.*go/i).click();
  }

  await expect(page.getByText(/what.*hot/i).first()).toBeVisible({
    timeout: 15000,
  });
}

async function createPost(page: Page, text: string) {
  await page.getByRole("button", { name: /compose.*post|new post/i }).click();
  await page.getByRole("textbox", { name: "Rich-Text Editor" }).fill(text);
  await page
    .getByText("CancelPost")
    .getByRole("button", { name: /post/i })
    .click();
  await setTimeout(500);
  await page.reload();
}

async function replyToPost(page: Page, postText: string, replyText: string) {
  await page
    .getByRole("link", { name: postText, exact: false })
    .getByRole("button", { name: /reply/i })
    .click();
  await page.getByRole("textbox", { name: "Rich-Text Editor" }).fill(replyText);
  await page
    .getByText("CancelReply")
    .getByRole("button", { name: /reply/i })
    .click();
  await setTimeout(5000);
  await page.reload();
}

async function likePost(page: Page, postText: string) {
  await page
    .getByRole("link", { name: postText, exact: false })
    .getByRole("button", { name: /like/i })
    .click();
  await setTimeout(5000);
  await page.reload();
}

test.describe("Alice and Bob interaction", () => {
  test("complete interaction flow", async ({ browser }, testInfo) => {
    const aliceName = `alice${uniqueId()}`;
    const alicePostText = `Hello from ${aliceName}`;

    const aliceContext = await browser.newContext({
      ...(process.env.CI && { recordVideo: { dir: testInfo.outputDir } }),
    });
    const aliceBrowser = await aliceContext.newPage();

    await aliceBrowser.goto(BASE_URL);
    await signUp(aliceBrowser, aliceName, PDS_URL);

    await createPost(aliceBrowser, alicePostText);
    await expect(
      aliceBrowser.getByText(alicePostText, { exact: false })
    ).toBeVisible();

    const bobName = `bob${uniqueId()}`;
    const bobContext = await browser.newContext({
      ...(process.env.CI && { recordVideo: { dir: testInfo.outputDir } }),
    });
    const bobBrowser = await bobContext.newPage();

    await bobBrowser.goto(BASE_URL);
    await signUp(bobBrowser, bobName, PDS_URL);

    await expect(bobBrowser.getByText(alicePostText)).toBeVisible();
    await likePost(bobBrowser, alicePostText);

    const bobReplyText = `Hello ${aliceName}, this is ${bobName}`;
    await replyToPost(bobBrowser, alicePostText, bobReplyText);

    await expect(bobBrowser.getByText(bobReplyText)).toBeVisible();

    await aliceBrowser.getByRole("link", { name: /notifications/i }).click();
    await aliceBrowser.reload();
    await expect(aliceBrowser.getByText(bobReplyText)).toBeVisible();

    await likePost(aliceBrowser, bobReplyText);
    await replyToPost(aliceBrowser, bobReplyText, `Thanks ${bobName}!`);
    await aliceBrowser.getByRole("link", { name: bobReplyText, exact: false }).click();
    await expect(aliceBrowser.getByText(`Thanks ${bobName}!`)).toBeVisible();

    await bobBrowser.reload();
    await bobBrowser.getByRole("link", { name: /notifications/i }).click();
    await likePost(bobBrowser, `Thanks ${bobName}!`);

    await aliceBrowser.getByRole("link", { name: /home/i }).click();
    await aliceBrowser.reload();
    await expect(
      aliceBrowser
        .getByRole("link", { name: `Thanks ${bobName}!`, exact: false })
        .getByRole("button", { name: /like.*1/i })
    ).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
