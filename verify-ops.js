import { Firehose } from "@skyware/firehose";
import WebSocket from "ws";

const firehose = new Firehose({
  relay: `https://pds.local.u-at-proto.work`,
  ws: WebSocket,
  cursor: "0"
});

let eventCount = 0;

firehose.on("commit", (commit) => {
  eventCount++;
  console.log(`\n=== Event ${eventCount} (seq ${commit.seq}) ===`);
  console.log(`Repo: ${commit.repo}`);
  console.log(`Rev: ${commit.rev}`);
  console.log(`Ops count: ${commit.ops.length}`);

  if (commit.ops.length > 0) {
    console.log("Ops:", JSON.stringify(commit.ops, null, 2));
  } else {
    console.log("WARNING: ops array is EMPTY!");
  }

  if (eventCount >= 6) {
    console.log("\n✅ Verified 6 events. Exiting...");
    firehose.close();
    process.exit(0);
  }
});

firehose.start();

setTimeout(() => {
  console.log(`\nTimeout reached. Saw ${eventCount} events.`);
  firehose.close();
  process.exit(1);
}, 10000);
