#!/bin/sh
set -e

echo "Waiting for Tailscale to be ready..."
sleep 3

mkdir -p /var/run/tailscale
ln -sf /tmp/tailscaled.sock /var/run/tailscale/tailscaled.sock

TAILSCALE_IP=$(tailscale ip -4)

if [ -z "$TAILSCALE_IP" ]; then
  echo "Error: Could not get Tailscale IP"
  exit 1
fi

echo "Updating Cloudflare DNS A record for *.${DOMAIN} to ${TAILSCALE_IP}"

ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN#*.}" \
  -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')

SUBDOMAIN="*.${DOMAIN%%.*}"

RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${SUBDOMAIN}.${DOMAIN#*.}&type=A" \
  -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')

if [ "$RECORD_ID" = "null" ] || [ -z "$RECORD_ID" ]; then
  echo "Creating new A record for ${SUBDOMAIN}"
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"${SUBDOMAIN}\",\"content\":\"${TAILSCALE_IP}\",\"ttl\":60,\"proxied\":false}"
else
  echo "Updating existing A record ID: ${RECORD_ID}"
  curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"${SUBDOMAIN}\",\"content\":\"${TAILSCALE_IP}\",\"ttl\":60,\"proxied\":false}"
fi

printf "\nDNS record updated successfully\n"

echo "Updating Cloudflare DNS A record for *.pds.${DOMAIN} to ${TAILSCALE_IP}"

PDS_SUBDOMAIN="*.pds.${DOMAIN%%.*}"

PDS_RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${PDS_SUBDOMAIN}.${DOMAIN#*.}&type=A" \
  -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')

if [ "$PDS_RECORD_ID" = "null" ] || [ -z "$PDS_RECORD_ID" ]; then
  echo "Creating new A record for ${PDS_SUBDOMAIN}"
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"${PDS_SUBDOMAIN}\",\"content\":\"${TAILSCALE_IP}\",\"ttl\":60,\"proxied\":false}"
else
  echo "Updating existing PDS A record ID: ${PDS_RECORD_ID}"
  curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${PDS_RECORD_ID}" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"${PDS_SUBDOMAIN}\",\"content\":\"${TAILSCALE_IP}\",\"ttl\":60,\"proxied\":false}"
fi

printf "\nPDS wildcard DNS record updated successfully\n"
