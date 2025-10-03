import { test, expect, Page } from "@playwright/test";

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

async function createPost(page: any, text: string) {
  await page.getByRole("button", { name: /compose.*post|new post/i }).click();
  await page.getByRole("textbox", { name: "Rich-Text Editor" }).fill(text);
  await page
    .getByText("CancelPost")
    .getByRole("button", { name: /post/i })
    .click();
}

test.describe("Alice and Bob interaction", () => {
  test("complete interaction flow", async ({ browser }) => {
    const aliceName = `alice${uniqueId()}`;
    const alicePostText = `Hello from ${aliceName}`;

    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();

    await alicePage.goto(BASE_URL);
    await signUp(alicePage, aliceName, PDS_URL);

    await createPost(alicePage, alicePostText);
    await alicePage.reload();
    await expect(
      alicePage.getByText(alicePostText, { exact: false })
    ).toBeVisible();

    const bobName = `bob${uniqueId()}`;
    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();

    await bobPage.goto(BASE_URL);
    await signUp(bobPage, bobName, PDS_URL);

    await expect(bobPage.getByText(alicePostText)).toBeVisible();
    await bobPage
      .getByRole("link", { name: alicePostText, exact: false })
      .getByRole("button", { name: /reply/i })
      .click();

    const bobReplyText = `Hello ${aliceName}, this is ${bobName}`;
    await bobPage
      .getByRole("textbox", { name: "Rich-Text Editor" })
      .fill(bobReplyText);
    await bobPage.getByText("CancelReply").getByRole("button", { name: /reply/i }).click();

    await expect(bobPage.getByText(bobReplyText)).toBeVisible();

    await bobPage
      .getByRole("link", { name: alicePostText, exact: false })
      .getByRole("button", { name: /like/i })
      .click();

    await alicePage.getByRole("link", { name: /notifications/i }).click();

    await expect(alicePage.getByText(bobReplyText)).toBeVisible();

    await alicePage
      .getByRole("link", { name: bobReplyText, exact: false })
      .getByRole("button", { name: /like/i })
      .click();

    await alicePage
      .getByRole("link", { name: bobReplyText, exact: false })
      .getByRole("button", { name: /reply/i })
      .click();
    await alicePage.getByRole("textbox", { name: "Rich-Text Editor" }).fill(`Thanks ${bobName}!`);
    await alicePage.getByText("CancelReply").getByRole("button", { name: /reply/i }).click();

    await expect(alicePage.getByText(`Thanks ${bobName}!`)).toBeVisible();

    await bobPage.reload();
    await bobPage.getByRole("link", { name: /notifications/i }).click();

    await bobPage
      .getByRole("link", { name: `Thanks ${bobName}!`, exact: false })
      .getByRole("button", { name: /like/i })
      .click();

    await alicePage.getByRole("link", { name: /home/i }).click();
    await alicePage.reload();
    await expect(
      alicePage
        .getByRole("link", { name: `Thanks ${bobName}!`, exact: false })
        .getByRole("button", { name: /like.*1/i })
    ).toBeVisible();

    await aliceContext.close();
    await bobContext.close();
  });
});
