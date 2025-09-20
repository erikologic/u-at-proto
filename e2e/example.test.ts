import { AtpAgent } from "@atproto/api";
import { Firehose } from "@skyware/firehose";

const TAILSCALE_DOMAIN = process.env.TAILSCALE_DOMAIN;
if (!TAILSCALE_DOMAIN) {
  throw new Error("TAILSCALE_DOMAIN env var is required");
}

describe("Local ATProto E2E Tests", () => {
  it("commits on a PDS are pushed on a relay", async () => {
    const commitEvents = [];
    const firehose = new Firehose({
      relay: `https://relay.${TAILSCALE_DOMAIN}`,
    });

    firehose.on("commit", (commit) => {
      commitEvents.push(commit);
    });

    firehose.start();

    const agent = new AtpAgent({
      service: `https://pds.${TAILSCALE_DOMAIN}`,
    });

    const rand = Math.floor(Math.random() * 10000);
    const name = `test${rand}`;
    await agent.createAccount({
      email: `${name}@mail.com`,
      password: "abc123",
      handle: `${name}.pds.${TAILSCALE_DOMAIN}`,
    });

    const test = "Hello world!";

    await agent.app.bsky.feed.post.create(
      { repo: agent.session?.did },
      {
        text: test,
        createdAt: new Date().toISOString(),
      }
    );

    firehose.close();

    expect(commitEvents.length).toBeGreaterThan(0);
    expect(commitEvents).toContain(
      expect.objectContaining({
        ops: expect.arrayContaining([
          expect.objectContaining({
            record: expect.objectContaining({
              text: test,
            }),
          }),
        ]),
      })
    );
  }, 30_000);
});
