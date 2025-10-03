#! /bin/sh

set -ex

# Tell the relay to crawl the PDS
curl -u admin:admin123 \
    -X POST "https://relay.${PARTITION}.${DOMAIN}/admin/pds/requestCrawl" \
    -H "Content-Type: application/json" \
    -d "{\"hostname\": \"pds.${PARTITION}.${DOMAIN}\"}"

echo "Preparation complete, marking as ready"
touch /tmp/ready

echo "Sleeping to support docker compose up -d --wait"
sleep infinity