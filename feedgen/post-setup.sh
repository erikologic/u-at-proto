#!/bin/sh
set -ex

echo "Waiting for feedgen to be ready..."
while ! wget --no-verbose --tries=1 --spider "https://${FEEDGEN_HOST}/.well-known/did.json" 2>/dev/null; do
  echo "Feedgen not ready yet, sleeping..."
  sleep 2
done
echo "Feedgen is ready"

FEEDGEN_HANDLE="${FEEDGEN_HANDLE:-feedgen.${PDS_HOST}}"
FEEDGEN_PASSWORD="${FEEDGEN_PASSWORD:-feedgen-password-123}"
FEEDGEN_EMAIL="${FEEDGEN_EMAIL:-feedgen@example.com}"
FEEDGEN_DISPLAY_NAME="${FEEDGEN_DISPLAY_NAME:-Whats Hot}"
FEEDGEN_DESCRIPTION="${FEEDGEN_DESCRIPTION:-Local feed showing recent posts}"
FEEDGEN_RECORD_NAME="${FEEDGEN_RECORD_NAME:-whats-hot}"

echo "Creating feedgen user account: ${FEEDGEN_HANDLE}"
CREATE_RESULT=$(curl -s -X POST "https://${PDS_HOST}/xrpc/com.atproto.server.createAccount" \
  -H "Content-Type: application/json" \
  -d "{
    \"handle\": \"${FEEDGEN_HANDLE}\",
    \"password\": \"${FEEDGEN_PASSWORD}\",
    \"email\": \"${FEEDGEN_EMAIL}\"
  }" || echo "")

if echo "$CREATE_RESULT" | grep -q "Handle already taken"; then
  echo "User account already exists, continuing..."
else
  echo "User account created successfully"
fi

echo "Logging in as feedgen user..."
LOGIN_RESULT=$(curl -s -X POST "https://${PDS_HOST}/xrpc/com.atproto.server.createSession" \
  -H "Content-Type: application/json" \
  -d "{
    \"identifier\": \"${FEEDGEN_HANDLE}\",
    \"password\": \"${FEEDGEN_PASSWORD}\"
  }")

ACCESS_JWT=$(echo "$LOGIN_RESULT" | grep -o '"accessJwt":"[^"]*' | cut -d'"' -f4)
FEEDGEN_DID=$(echo "$LOGIN_RESULT" | grep -o '"did":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_JWT" ] || [ -z "$FEEDGEN_DID" ]; then
  echo "Failed to login as feedgen user"
  exit 1
fi

echo "Logged in successfully, DID: ${FEEDGEN_DID}"

FEEDGEN_SERVICE_DID=$(wget -qO- "https://${FEEDGEN_HOST}/.well-known/did.json" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo "Publishing feed generator record..."
curl -s -X POST "https://${PDS_HOST}/xrpc/com.atproto.repo.putRecord" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_JWT}" \
  -d "{
    \"repo\": \"${FEEDGEN_DID}\",
    \"collection\": \"app.bsky.feed.generator\",
    \"rkey\": \"${FEEDGEN_RECORD_NAME}\",
    \"record\": {
      \"\$type\": \"app.bsky.feed.generator\",
      \"did\": \"${FEEDGEN_SERVICE_DID}\",
      \"displayName\": \"${FEEDGEN_DISPLAY_NAME}\",
      \"description\": \"${FEEDGEN_DESCRIPTION}\",
      \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
    }
  }"

echo "Feed generator published successfully!"
echo "Feed URI: at://${FEEDGEN_DID}/app.bsky.feed.generator/${FEEDGEN_RECORD_NAME}"

echo "Writing feedgen publisher DID to shared volume..."
echo "${FEEDGEN_DID}" > /shared/publisher-did.txt
echo "Feedgen publisher DID written to /shared/publisher-did.txt"

echo "Feedgen setup complete, marking as ready"
touch /tmp/ready

echo "Sleeping to support docker compose up -d --wait"
sleep infinity
