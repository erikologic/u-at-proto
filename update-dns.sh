#!/bin/sh
set -e

echo "Starting DNS update script..."

require_env() {
  local var_name="$1"
  eval local var_value=\$$var_name
  if [ -z "$var_value" ]; then
    echo "ERROR: ${var_name} not set"
    exit 1
  fi
}

validate_env() {
  require_env "CF_DNS_API_TOKEN"
  require_env "DOMAIN"
  require_env "PARTITION"
  echo "Environment variables validated"
}

wait_for_tailscale() {
  sleep 3
  mkdir -p /var/run/tailscale
  ln -sf /tmp/tailscaled.sock /var/run/tailscale/tailscaled.sock
}

get_tailscale_ip() {
  local ip=$(tailscale ip -4)
  [ -z "$ip" ] && echo "Failed to get Tailscale IP" && exit 1
  echo "$ip"
}

get_zone_id() {
  local base_domain="$1"
  local response=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=${base_domain}" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json")
  local zone_id=$(echo "$response" | jq -r '.result[0].id')
  if [ "$zone_id" = "null" ] || [ -z "$zone_id" ]; then
    echo "Failed to get zone ID for ${base_domain}" >&2
    echo "Response: $response" >&2
    exit 1
  fi
  echo "$zone_id"
}

get_record_id() {
  local zone_id="$1"
  local record_name="$2"
  curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?name=${record_name}&type=A" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json" | jq -r '.result[0].id'
}

create_dns_record() {
  local zone_id="$1"
  local name="$2"
  local ip="$3"
  echo "Creating DNS record ${name} -> ${ip}"
  local response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"${name}\",\"content\":\"${ip}\",\"ttl\":60,\"proxied\":false}")
  local success=$(echo "$response" | jq -r '.success')
  if [ "$success" != "true" ]; then
    echo "Failed to create DNS record" >&2
    echo "Response: $response" >&2
    exit 1
  fi
  echo "DNS record created successfully"
}

update_dns_record() {
  local zone_id="$1"
  local record_id="$2"
  local name="$3"
  local ip="$4"
  echo "Updating DNS record ${name} -> ${ip}"
  local response=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records/${record_id}" \
    -H "Authorization: Bearer ${CF_DNS_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"${name}\",\"content\":\"${ip}\",\"ttl\":60,\"proxied\":false}")
  local success=$(echo "$response" | jq -r '.success')
  if [ "$success" != "true" ]; then
    echo "Failed to update DNS record"
    echo "Response: $response"
    exit 1
  fi
  echo "DNS record updated successfully"
}

main() {
  validate_env
  wait_for_tailscale

  local ip=$(get_tailscale_ip)

  local full_domain="${PARTITION}.${DOMAIN}"
  local base_domain="${full_domain#*.}"
  local partition_prefix="${full_domain%%.*}"

  echo "Updating DNS for ${full_domain} (partition: ${partition_prefix}, base: ${base_domain}) to ${ip}"

  local zone_id=$(get_zone_id "$base_domain")

  local wildcard="*.${partition_prefix}"
  local wildcard_full="${wildcard}.${base_domain}"
  local record_id=$(get_record_id "$zone_id" "$wildcard_full")
  if [ "$record_id" = "null" ] || [ -z "$record_id" ]; then
    create_dns_record "$zone_id" "$wildcard" "$ip"
  else
    update_dns_record "$zone_id" "$record_id" "$wildcard" "$ip"
  fi

  local pds_wildcard="*.pds.${partition_prefix}"
  local pds_wildcard_full="${pds_wildcard}.${base_domain}"
  local pds_record_id=$(get_record_id "$zone_id" "$pds_wildcard_full")
  if [ "$pds_record_id" = "null" ] || [ -z "$pds_record_id" ]; then
    create_dns_record "$zone_id" "$pds_wildcard" "$ip"
  else
    update_dns_record "$zone_id" "$pds_record_id" "$pds_wildcard" "$ip"
  fi
}

main
