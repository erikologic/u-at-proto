import { AtpAgent } from "@atproto/api";
import { Firehose } from "@skyware/firehose";

const TAILSCALE_DOMAIN = process.env.TAILSCALE_DOMAIN;
if (!TAILSCALE_DOMAIN) {
  throw new Error("TAILSCALE_DOMAIN env var is required");
}

const PARTITION = process.env.PARTITION;
if (!PARTITION) {
  throw new Error("PARTITION env var is required");
}

const RELAY_DOMAIN = `relay-${PARTITION}.${TAILSCALE_DOMAIN}`;
const PDS_DOMAIN = `pds-${PARTITION}.${TAILSCALE_DOMAIN}`;

describe("Local ATProto E2E Tests", () => {
  it("commits on a PDS are pushed on a relay", async () => {
    const commitEvents = [];
    const firehose = new Firehose({
      relay: `https://${RELAY_DOMAIN}`,
    });

    firehose.on("commit", (commit) => {
      commitEvents.push(commit);
    });

    firehose.start();

    const agent = new AtpAgent({
      service: `https://${PDS_DOMAIN}`,
    });

    const rand = Math.floor(Math.random() * 10000);
    const name = `test${rand}`;
    await agent.createAccount({
      email: `${name}@mail.com`,
      password: "abc123",
      handle: `${name}.${PDS_DOMAIN}`,
    });

    const test = "Hello world!";

    await agent.app.bsky.feed.post.create(
      { repo: agent.session?.did },
      {
        text: test,
        createdAt: new Date().toISOString(),
      }
    );

    // Wait for events to propagate to the relay
    await new Promise((resolve) => setTimeout(resolve, 5000));

    firehose.close();

    expect(commitEvents.length).toBeGreaterThan(0);
    expect(commitEvents).toContainEqual(
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
