#! /bin/sh

set -ex

# =============================================================================
# STEP 1: Request relay to crawl the PDS
# =============================================================================
curl -u admin:admin123 \
    -X POST "https://relay.${PARTITION}.${DOMAIN}/admin/pds/requestCrawl" \
    -H "Content-Type: application/json" \
    -d "{\"hostname\": \"pds.${PARTITION}.${DOMAIN}\"}"

# =============================================================================
# STEP 2: Wait for feedgen service to be ready
# =============================================================================
echo "Waiting for feedgen to be ready..."
while ! wget --no-verbose --tries=1 --spider "http://feedgen:3000/.well-known/did.json" 2>/dev/null; do
  echo "Feedgen not ready yet, sleeping..."
  sleep 2
done
echo "Feedgen is ready"

# =============================================================================
# STEP 3: Configure feedgen account details
# =============================================================================
FEEDGEN_HANDLE="${FEEDGEN_HANDLE:-feedgen.pds.${PARTITION}.${DOMAIN}}"
FEEDGEN_PASSWORD="${FEEDGEN_PASSWORD:-feedgen-password-123}"
FEEDGEN_EMAIL="${FEEDGEN_EMAIL:-feedgen@example.com}"
FEEDGEN_DISPLAY_NAME="${FEEDGEN_DISPLAY_NAME:-Whats Hot}"
FEEDGEN_DESCRIPTION="${FEEDGEN_DESCRIPTION:-Local feed showing recent posts}"
FEEDGEN_RECORD_NAME="${FEEDGEN_RECORD_NAME:-whats-hot}"

# =============================================================================
# STEP 4: Create feedgen user account on PDS (if it doesn't exist)
# =============================================================================
echo "Creating feedgen user account: ${FEEDGEN_HANDLE}"
CREATE_RESULT=$(curl -s -X POST "https://pds.${PARTITION}.${DOMAIN}/xrpc/com.atproto.server.createAccount" \
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

# =============================================================================
# STEP 5: Login as feedgen user and get JWT + DID
# =============================================================================
echo "Logging in as feedgen user..."
LOGIN_RESULT=$(curl -s -X POST "https://pds.${PARTITION}.${DOMAIN}/xrpc/com.atproto.server.createSession" \
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

# =============================================================================
# STEP 6: Get the feedgen service DID from its well-known endpoint
# =============================================================================
FEEDGEN_SERVICE_DID=$(wget -qO- "http://feedgen:3000/.well-known/did.json" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

# =============================================================================
# STEP 7: Publish the feed generator record to the PDS
# =============================================================================
echo "Publishing feed generator record..."
curl -s -X POST "https://pds.${PARTITION}.${DOMAIN}/xrpc/com.atproto.repo.putRecord" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_JWT}" \
  -d "{
    \"repo\": \"${FEEDGEN_DID}\",
    \"collection\": \"app.bsky.feed.generator\",
    \"rkey\": \"${FEEDGEN_RECORD_NAME}\",
    \"record\": {
      \"did\": \"${FEEDGEN_SERVICE_DID}\",
      \"displayName\": \"${FEEDGEN_DISPLAY_NAME}\",
      \"description\": \"${FEEDGEN_DESCRIPTION}\",
      \"createdAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"
    }
  }"

echo "Feed generator published successfully!"
echo "Feed URI: at://${FEEDGEN_DID}/app.bsky.feed.generator/${FEEDGEN_RECORD_NAME}"

# =============================================================================
# STEP 8: Save feedgen publisher DID to shared volume for social-app
# =============================================================================
echo "Writing feedgen publisher DID to shared volume..."
echo "${FEEDGEN_DID}" > /shared/publisher-did.txt
echo "Feedgen publisher DID written to /shared/publisher-did.txt"

# =============================================================================
# STEP 9: Mark service as ready and keep container alive
# =============================================================================
echo "Preparation complete, marking as ready"
touch /tmp/ready

echo "Sleeping to support docker compose up -d --wait"
sleep infinity
