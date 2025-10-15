import WebSocket from "ws";
import cbor from "cbor";

const ws = new WebSocket("wss://blacksky.app/xrpc/com.atproto.sync.subscribeRepos?cursor=4397000");

let eventCount = 0;
const eventTypes = {};

ws.on("open", () => {
  console.log("Connected to production RSky PDS");
});

ws.on("message", (data) => {
  try {
    // Parse the frame header
    const header = cbor.decodeFirstSync(data.slice(0, data.indexOf(0x00) + 1));

    // Get the event type from the header
    const eventType = header?.t || header?.$type || "unknown";
    eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;

    eventCount++;

    if (eventCount <= 100) {
      console.log(`Event ${eventCount}: ${eventType}`);
    }

    if (eventCount === 100) {
      console.log("\n=== Event Type Summary (first 100 events) ===");
      Object.entries(eventTypes).forEach(([type, count]) => {
        console.log(`${type}: ${count}`);
      });
      ws.close();
      process.exit(0);
    }
  } catch (e) {
    console.error(`Error parsing event ${eventCount}:`, e.message);
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
  process.exit(1);
});

ws.on("close", () => {
  console.log("\nConnection closed.");
  console.log(`\nTotal events: ${eventCount}`);
  console.log("\n=== Final Event Type Summary ===");
  Object.entries(eventTypes).forEach(([type, count]) => {
    console.log(`${type}: ${count}`);
  });
  process.exit(0);
});

setTimeout(() => {
  console.log("Timeout reached");
  ws.close();
}, 30000);
