import { AtpAgent } from "@atproto/api";
import { Firehose } from "@skyware/firehose";
import WebSocket from "ws";
import "dotenv/config";

const DOMAIN = process.env.DOMAIN;
if (!DOMAIN) {
  throw new Error("DOMAIN env var is required");
}
const PARTITION = process.env.PARTITION;
if (!PARTITION) {
  throw new Error("PARTITION env var is required");
}

const RELAY_DOMAIN = `relay.${PARTITION}.${DOMAIN}`;
const PDS_DOMAIN = `pds.${PARTITION}.${DOMAIN}`;
const JETSTREAM_DOMAIN = `jetstream.${PARTITION}.${DOMAIN}`;
const BSKY_DOMAIN = `bsky.${PARTITION}.${DOMAIN}`;

class FirehoseEventCollector {
  public readonly events: any[] = [];
  private readonly firehose: Firehose;

  constructor(endpoint: string) {
    this.firehose = new Firehose({ relay: `https://${endpoint}` });
    this.firehose.on("commit", (commit) => {
      this.events.push(commit);
    });
    this.firehose.start();
  }

  stop(): void {
    this.firehose.close();
  }
}

jest.setTimeout(60_000);

class JetstreamEventCollector {
  public readonly events: any[] = [];
  private readonly websocket: WebSocket;

  private constructor(websocket: WebSocket) {
    this.websocket = websocket;
    this.websocket.on("message", (data) => {
      try {
        const event = JSON.parse(data.toString());
        if (event.kind === "commit") {
          this.events.push(event);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });
  }

  static async create(domain: string): Promise<JetstreamEventCollector> {
    const websocket = new WebSocket(
      `wss://${PARTITION}.${DOMAIN}/subscribe?wantedCollections=app.bsky.feed.post`
    );

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Jetstream connection timeout"));
      }, 30000);

      websocket.on("open", () => {
        clearTimeout(timeout);
        resolve(new JetstreamEventCollector(websocket));
      });

      websocket.on("error", (error: Error) => {
        clearTimeout(timeout);
        reject(new Error(`Jetstream connection failed: ${error.message}`));
      });
    });
  }

  stop(): void {
    this.websocket.close();
  }
}

class UserManager {
  private constructor(
    public agent: AtpAgent,
    public did: string,
    public handle: string
  ) {}

  static async create(pdsUrl: string, username?: string): Promise<UserManager> {
    const agent = new AtpAgent({ service: pdsUrl });

    const name = `${username || "test"}${Math.floor(Math.random() * 10000)}`;
    const handle = `${name}.${PDS_DOMAIN}`;
    await agent.createAccount({
      email: `${name}@mail.com`,
      password: "abc123",
      handle,
    });

    const did = agent.session?.did;
    if (!did) {
      throw new Error("Failed to create account - no DID received");
    }

    await agent.com.atproto.repo.putRecord({
      repo: did,
      collection: "app.bsky.actor.profile",
      rkey: "self",
      record: {
        $type: "app.bsky.actor.profile",
        displayName: name,
      },
    });

    return new UserManager(agent, did, handle);
  }

  async createPost(text: string): Promise<void> {
    await this.agent.app.bsky.feed.post.create(
      { repo: this.did },
      {
        text,
        createdAt: new Date().toISOString(),
      }
    );
  }
}

function expectFirehoseCommitWith(text: string) {
  return expect.objectContaining({
    ops: expect.arrayContaining([
      expect.objectContaining({
        record: expect.objectContaining({ text }),
      }),
    ]),
  });
}

function expectedJetstreamCommitWith(text: string) {
  return expect.objectContaining({
    kind: "commit",
    commit: expect.objectContaining({
      operation: "create",
      collection: "app.bsky.feed.post",
      record: expect.objectContaining({ text }),
    }),
  });
}

describe("Local ATProto E2E Tests", () => {
  let pdsCollector: FirehoseEventCollector;
  let relayCollector: FirehoseEventCollector;
  let jetstreamCollector: JetstreamEventCollector;
  let userManager: UserManager;

  beforeAll(async () => {
    pdsCollector = new FirehoseEventCollector(PDS_DOMAIN);
    relayCollector = new FirehoseEventCollector(RELAY_DOMAIN);
    jetstreamCollector = await JetstreamEventCollector.create(JETSTREAM_DOMAIN);
    userManager = await UserManager.create(`https://${PDS_DOMAIN}`);
  }, 30_000);

  afterAll(() => {
    pdsCollector?.stop();
    relayCollector?.stop();
    jetstreamCollector?.stop();
  });

  it("commit appears at PDS, Relay Firehose, and Jetstream endpoints", async () => {
    const postText = "Hello world!";
    await userManager.createPost(postText);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    expect(pdsCollector.events).toContainEqual(
      expectFirehoseCommitWith(postText)
    );
    expect(relayCollector.events).toContainEqual(
      expectFirehoseCommitWith(postText)
    );
    expect(jetstreamCollector.events).toContainEqual(
      expectedJetstreamCommitWith(postText)
    );

    console.error("did ", userManager.did);
    console.error("handle ", userManager.handle);
    const bskyAgent = new AtpAgent({ service: `https://${BSKY_DOMAIN}` });
    const authorFeed = await bskyAgent.app.bsky.feed.getAuthorFeed({
      actor: userManager.did,
    });

    console.log(JSON.stringify(authorFeed.data, null, 2));
    expect(authorFeed.data.feed.length).toBeGreaterThan(0);
    expect(authorFeed.data.feed[0].post.record.text).toBe(postText);
  });
});

xdescribe("Synthetic Data Generation", () => {
  let pdsCollector: FirehoseEventCollector;
  let relayCollector: FirehoseEventCollector;
  let jetstreamCollector: JetstreamEventCollector;
  let alice: UserManager;
  let bob: UserManager;

  beforeAll(async () => {
    pdsCollector = new FirehoseEventCollector(PDS_DOMAIN);
    relayCollector = new FirehoseEventCollector(RELAY_DOMAIN);
    jetstreamCollector = await JetstreamEventCollector.create(JETSTREAM_DOMAIN);

    alice = await UserManager.create(`https://${PDS_DOMAIN}`, "alice");
    bob = await UserManager.create(`https://${PDS_DOMAIN}`, "bob");
  });

  afterAll(() => {
    pdsCollector?.stop();
    relayCollector?.stop();
    jetstreamCollector?.stop();
  });

  it("generates conversation between two users", async () => {
    const initialEventCount = {
      pds: pdsCollector.events.length,
      relay: relayCollector.events.length,
      jetstream: jetstreamCollector.events.length,
    };

    const conversation = [
      { user: alice, message: "Hey Bob! How's the weather today?" },
      {
        user: bob,
        message: "Hi Alice! It's quite sunny here. Perfect for a walk!",
      },
      {
        user: alice,
        message: "That sounds lovely! I'm stuck inside working on some code.",
      },
      { user: bob, message: "What are you working on? Anything interesting?" },
      {
        user: alice,
        message: "Just some ATProto integration tests. Pretty cool stuff!",
      },
      {
        user: bob,
        message: "Nice! I've been curious about decentralized social networks.",
      },
    ];

    for (const { user, message } of conversation) {
      await user.createPost(message);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));

    const finalEventCount = {
      pds: pdsCollector.events.length,
      relay: relayCollector.events.length,
      jetstream: jetstreamCollector.events.length,
    };

    const newEvents = {
      pds: finalEventCount.pds - initialEventCount.pds,
      relay: finalEventCount.relay - initialEventCount.relay,
      jetstream: finalEventCount.jetstream - initialEventCount.jetstream,
    };

    expect(newEvents.pds).toBeGreaterThanOrEqual(6);
    expect(newEvents.relay).toBeGreaterThanOrEqual(6);
    expect(newEvents.jetstream).toBeGreaterThanOrEqual(6);

    for (const { message } of conversation) {
      expect(pdsCollector.events).toContainEqual(
        expectFirehoseCommitWith(message)
      );
      expect(relayCollector.events).toContainEqual(
        expectFirehoseCommitWith(message)
      );
      expect(jetstreamCollector.events).toContainEqual(
        expectedJetstreamCommitWith(message)
      );
    }
  });
});
