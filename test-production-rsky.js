import { Firehose } from "@skyware/firehose";
import WebSocket from "ws";

const firehose = new Firehose({
  relay: `https://blacksky.app`,
  ws: WebSocket,
  cursor: "4397000"  // Get some historical events to see sync events
});

let eventCount = 0;
const eventTypes = new Set();

firehose.on("commit", (commit) => {
  eventCount++;
  console.log(`\n=== Production Event ${eventCount} (seq ${commit.seq}) ===`);
  console.log(`Repo: ${commit.repo}`);
  console.log(`Rev: ${commit.rev}`);
  console.log(`Ops count: ${commit.ops.length}`);

  if (commit.ops.length > 0) {
    console.log(`First op: ${commit.ops[0].action} ${commit.ops[0].path}`);
  } else {
    console.log("WARNING: ops array is EMPTY!");
  }

  // Check for prevData field
  if (commit.prevData !== undefined) {
    console.log(`prevData: ${commit.prevData}`);
  } else {
    console.log("prevData: NOT PRESENT");
  }

  if (eventCount >= 50) {
    console.log("\n✅ Observed 50 events from production. Exiting...");
    firehose.close();
    process.exit(0);
  }
});

firehose.on("identity", (identity) => {
  console.log(`\n=== Identity Event (seq ${identity.seq}) ===`);
  console.log(`DID: ${identity.did}`);
  console.log(`Handle: ${identity.handle}`);
});

firehose.on("account", (account) => {
  console.log(`\n=== Account Event (seq ${account.seq}) ===`);
  console.log(`DID: ${account.did}`);
  console.log(`Active: ${account.active}`);
});

firehose.start();

console.log("Connecting to production RSky PDS at blacksky.app...");

setTimeout(() => {
  console.log(`\nTimeout reached. Saw ${eventCount} events.`);
  console.log(`Event types seen: ${Array.from(eventTypes).join(", ")}`);
  firehose.close();
  process.exit(1);
}, 30000);
