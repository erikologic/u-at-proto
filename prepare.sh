#! /bin/sh

set -ex

# Tell the relay to crawl the PDS
curl -u admin:admin123 \
    -X POST "https://relay-${PARTITION}.${TAILSCALE_DOMAIN}/admin/pds/requestCrawl" \
    -H "Content-Type: application/json" \
    -d "{\"hostname\": \"pds-${PARTITION}.${TAILSCALE_DOMAIN}\"}"