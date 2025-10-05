#!/bin/sh
set -ex

echo "Requesting relay to crawl PDS..."
curl -u admin:admin123 \
    -X POST "https://${RELAY_HOST}/admin/pds/requestCrawl" \
    -H "Content-Type: application/json" \
    -d "{\"hostname\": \"${PDS_HOST}\"}"

echo "Relay crawl request completed successfully"
touch /tmp/ready

echo "Sleeping to support docker compose up -d --wait"
sleep infinity
