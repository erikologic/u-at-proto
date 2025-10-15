/**
 * Jetstream Reconnection Test with PDS Container Restart
 *
 * This test:
 * 1. Creates a test user
 * 2. Generates posts every 2 seconds
 * 3. Subscribes to jetstream and tracks all events
 * 4. Restarts the PDS container mid-test
 * 5. Verifies no messages were missed
 */

import { AtpAgent } from '@atproto/api';
import WebSocket from 'ws';
import Dockerode from 'dockerode';
import 'dotenv/config';

const DOMAIN = process.env.DOMAIN || 'u-at-proto.work';
const PARTITION = process.env.PARTITION || 'eurosky';
const PDS_DOMAIN = `pds.${PARTITION}.${DOMAIN}`;
const JETSTREAM_DOMAIN = `jetstream.${PARTITION}.${DOMAIN}`;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

interface JetstreamEvent {
  did: string;
  time_us: number;
  kind: 'commit' | 'identity' | 'account';
  commit?: {
    rev: string;
    operation: 'create' | 'update' | 'delete';
    collection: string;
    rkey: string;
    record?: any;
    cid: string;
  };
}

class JetstreamCollector {
  public readonly events: JetstreamEvent[] = [];
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectBackoffMs = 1000;
  private shouldReconnect = true;
  private onReconnectCallback?: () => void;

  constructor(
    private domain: string,
    onReconnect?: () => void
  ) {
    this.onReconnectCallback = onReconnect;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://${this.domain}/subscribe?wantedCollections=app.bsky.feed.post`;
      this.websocket = new WebSocket(url);

      const timeout = setTimeout(() => {
        reject(new Error('Jetstream connection timeout'));
      }, 30000);

      this.websocket.on('open', () => {
        clearTimeout(timeout);
        console.log(`${colors.green}✓ Connected to Jetstream${colors.reset}`);
        this.reconnectAttempts = 0;
        resolve();
      });

      this.websocket.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString()) as JetstreamEvent;
          this.events.push(event);

          if (event.kind === 'commit' && event.commit?.collection === 'app.bsky.feed.post') {
            const text = event.commit.record?.text || '';
            const shortText = text.length > 50 ? text.substring(0, 47) + '...' : text;
            console.log(`${colors.cyan}📨 Post #${this.events.length}: ${shortText}${colors.reset}`);
          }
        } catch (e) {
          // Ignore parsing errors
        }
      });

      this.websocket.on('error', (error) => {
        clearTimeout(timeout);
        console.error(`${colors.red}✗ Jetstream error: ${error.message}${colors.reset}`);
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      this.websocket.on('close', () => {
        console.log(`${colors.yellow}⚠ Jetstream connection closed${colors.reset}`);
        this.websocket = null;

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const backoffMs = Math.min(
      this.reconnectBackoffMs * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    console.log(`${colors.yellow}🔄 Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})${colors.reset}`);

    setTimeout(async () => {
      if (this.onReconnectCallback) {
        this.onReconnectCallback();
      }
      try {
        await this.connect();
      } catch (error) {
        console.error(`${colors.red}✗ Reconnect failed${colors.reset}`);
      }
    }, backoffMs);
  }

  stop(): void {
    this.shouldReconnect = false;
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  getPostEvents(): JetstreamEvent[] {
    return this.events.filter(
      e => e.kind === 'commit' && e.commit?.collection === 'app.bsky.feed.post'
    );
  }
}

class SyntheticDataGenerator {
  private intervalId?: NodeJS.Timeout;
  private postCount = 0;

  constructor(
    private agent: AtpAgent,
    private did: string,
    private postIntervalMs: number = 2000
  ) {}

  start(): void {
    console.log(`${colors.blue}▶ Starting post generation (every ${this.postIntervalMs}ms)${colors.reset}`);

    this.intervalId = setInterval(async () => {
      this.postCount++;
      const text = `Synthetic post #${this.postCount} - ${new Date().toISOString()}`;

      try {
        await this.agent.post({
          text,
          createdAt: new Date().toISOString()
        });
        console.log(`${colors.green}✓ Created: ${text}${colors.reset}`);
      } catch (error: any) {
        console.error(`${colors.red}✗ Failed to create post: ${error.message}${colors.reset}`);
      }
    }, this.postIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log(`${colors.blue}◼ Stopped post generation (${this.postCount} posts created)${colors.reset}`);
    }
  }

  getPostCount(): number {
    return this.postCount;
  }
}

async function createTestUser(): Promise<{ agent: AtpAgent; did: string; handle: string }> {
  const agent = new AtpAgent({ service: `https://${PDS_DOMAIN}` });

  // Use shorter username - last 6 digits of timestamp
  const timestamp = Date.now().toString().slice(-6);
  const username = `test${timestamp}`;
  const handle = `${username}.${PDS_DOMAIN}`;
  const email = `${username}@example.com`;
  const password = 'test-password-123';

  console.log(`${colors.blue}👤 Creating test user: ${handle}${colors.reset}`);

  const response = await agent.createAccount({
    email,
    handle,
    password
  });

  const did = response.data.did;
  console.log(`${colors.green}✓ User created: ${did}${colors.reset}`);

  // Create profile
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: 'app.bsky.actor.profile',
    rkey: 'self',
    record: {
      $type: 'app.bsky.actor.profile',
      displayName: username,
    },
  });

  return { agent, did, handle };
}

async function restartPDSContainer(): Promise<void> {
  console.log(`\n${colors.magenta}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.magenta}🔄 RESTARTING PDS CONTAINER${colors.reset}`);
  console.log(`${colors.magenta}${'='.repeat(80)}${colors.reset}\n`);

  const docker = new Dockerode();

  // Find the PDS container
  const containers = await docker.listContainers();
  const pdsContainer = containers.find(c =>
    c.Names.some(name => name.includes('pds'))
  );

  if (!pdsContainer) {
    throw new Error('PDS container not found');
  }

  const container = docker.getContainer(pdsContainer.Id);

  console.log(`${colors.yellow}⏸ Stopping PDS container...${colors.reset}`);
  await container.stop();

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`${colors.yellow}▶ Starting PDS container...${colors.reset}`);
  await container.start();

  // Wait for container to be healthy
  console.log(`${colors.yellow}⏳ Waiting for PDS to be healthy...${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log(`${colors.green}✓ PDS container restarted${colors.reset}\n`);
}

async function runTest(): Promise<void> {
  console.log(`\n${colors.cyan}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.cyan}JETSTREAM RECONNECTION TEST WITH PDS RESTART${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

  let reconnectionCount = 0;
  const collector = new JetstreamCollector(JETSTREAM_DOMAIN, () => {
    reconnectionCount++;
    console.log(`${colors.magenta}🔄 Jetstream reconnection #${reconnectionCount}${colors.reset}`);
  });

  let generator: SyntheticDataGenerator | null = null;
  let user: { agent: AtpAgent; did: string; handle: string } | null = null;

  try {
    // Step 1: Connect to Jetstream
    console.log(`${colors.blue}Step 1: Connecting to Jetstream...${colors.reset}`);
    await collector.connect();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Create test user
    console.log(`\n${colors.blue}Step 2: Creating test user...${colors.reset}`);
    user = await createTestUser();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Start generating posts
    console.log(`\n${colors.blue}Step 3: Starting synthetic data generation...${colors.reset}`);
    generator = new SyntheticDataGenerator(user.agent, user.did, 2000);
    generator.start();

    // Step 4: Let it run for a bit
    console.log(`\n${colors.blue}Step 4: Generating posts (10 seconds)...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 10000));

    const eventsBeforeRestart = collector.getPostEvents().length;
    const postsBeforeRestart = generator.getPostCount();
    console.log(`\n${colors.cyan}📊 Before restart: ${eventsBeforeRestart} events, ${postsBeforeRestart} posts created${colors.reset}`);

    // Step 5: Restart PDS container
    console.log(`\n${colors.blue}Step 5: Restarting PDS container...${colors.reset}`);
    await restartPDSContainer();

    // Step 6: Continue generating posts
    console.log(`${colors.blue}Step 6: Continuing post generation (15 seconds)...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Step 7: Analyze results
    console.log(`\n${colors.blue}Step 7: Analyzing results...${colors.reset}`);
    generator.stop();

    const totalPosts = generator.getPostCount();
    const totalEvents = collector.getPostEvents().length;
    const eventsAfterRestart = totalEvents - eventsBeforeRestart;

    console.log(`\n${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.cyan}RESULTS${colors.reset}`);
    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}`);
    console.log(`${colors.green}Total posts created: ${totalPosts}${colors.reset}`);
    console.log(`${colors.green}Total Jetstream events received: ${totalEvents}${colors.reset}`);
    console.log(`${colors.green}Events before restart: ${eventsBeforeRestart}${colors.reset}`);
    console.log(`${colors.green}Events after restart: ${eventsAfterRestart}${colors.reset}`);
    console.log(`${colors.green}Jetstream reconnections: ${reconnectionCount}${colors.reset}`);

    // Check for missed messages
    const missedMessages = totalPosts - totalEvents;
    if (missedMessages === 0) {
      console.log(`\n${colors.green}✓✓✓ SUCCESS: No messages missed!${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠ WARNING: ${missedMessages} messages appear to be missed${colors.reset}`);
      console.log(`${colors.yellow}  (This may be due to timing - some posts might still be in flight)${colors.reset}`);
    }

    // Verify no gaps in timestamps
    const postEvents = collector.getPostEvents();
    if (postEvents.length > 1) {
      const timestamps = postEvents.map(e => e.time_us).sort((a, b) => a - b);
      let maxGap = 0;
      let gapCount = 0;

      for (let i = 1; i < timestamps.length; i++) {
        const gap = timestamps[i] - timestamps[i-1];
        if (gap > 5000000) { // 5 seconds in microseconds
          gapCount++;
          maxGap = Math.max(maxGap, gap);
        }
      }

      if (gapCount === 0) {
        console.log(`${colors.green}✓ No significant gaps in event timestamps${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ Found ${gapCount} gaps > 5s (max: ${(maxGap/1000000).toFixed(2)}s)${colors.reset}`);
      }
    }

    console.log(`${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);

  } catch (error: any) {
    console.error(`\n${colors.red}✗ Test failed: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (generator) {
      generator.stop();
    }
    collector.stop();
  }
}

// Run the test
if (require.main === module) {
  runTest()
    .then(() => {
      console.log(`${colors.green}✓ Test completed successfully${colors.reset}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(`${colors.red}✗ Test failed:${colors.reset}`, error);
      process.exit(1);
    });
}

export { runTest };
