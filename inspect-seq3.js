import { Firehose } from "@skyware/firehose";
import WebSocket from "ws";

const firehose = new Firehose({
  relay: `https://pds.local.u-at-proto.work`,
  ws: WebSocket,
  cursor: "2"  // Start from seq 3
});

firehose.on("commit", (commit) => {
  if (commit.seq === 3) {
    console.log("\n=== Seq 3 Event Details ===");
    console.log("Repo:", commit.repo);
    console.log("Rev:", commit.rev);
    console.log("Ops:", commit.ops);
    console.log("Since:", commit.since);
    console.log("Prev:", commit.prev);
    firehose.close();
    process.exit(0);
  }
});

firehose.start();

setTimeout(() => {
  console.log("Timeout");
  firehose.close();
  process.exit(1);
}, 5000);
