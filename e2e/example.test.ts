import { AtpAgent } from "@atproto/api";
import { Firehose } from "@skyware/firehose";
import WebSocket from "ws";
import "dotenv/config";

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
const JETSTREAM_DOMAIN = `jetstream-${PARTITION}.${TAILSCALE_DOMAIN}`;

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
      `wss://${domain}/subscribe?wantedCollections=app.bsky.feed.post`
    );

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Jetstream connection timeout"));
      }, 10000);

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
  private readonly agent: AtpAgent;
  private readonly _did: string;

  private constructor(agent: AtpAgent, did: string) {
    this.agent = agent;
    this._did = did;
  }

  get did(): string {
    return this._did;
  }

  static async create(pdsUrl: string): Promise<UserManager> {
    const agent = new AtpAgent({ service: pdsUrl });

    const rand = Math.floor(Math.random() * 10000);
    const name = `test${rand}`;
    await agent.createAccount({
      email: `${name}@mail.com`,
      password: "abc123",
      handle: `${name}.${PDS_DOMAIN}`,
    });

    const did = agent.session?.did;
    if (!did) {
      throw new Error("Failed to create account - no DID received");
    }

    return new UserManager(agent, did);
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
    pdsCollector.stop();
    relayCollector.stop();
    jetstreamCollector.stop();
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
  }, 30_000);
});
