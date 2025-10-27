#!/bin/sh
set -e

echo "Reading feedgen publisher DID from shared volume..."

DID_FILE="/shared/publisher-did.txt"

if [ -f "$DID_FILE" ]; then
  PUBLISHER_DID=$(cat "$DID_FILE" | tr -d '\n\r ')
  if [ -n "$PUBLISHER_DID" ]; then
    echo "Using feedgen publisher DID: $PUBLISHER_DID"
    export FEED_OWNER_DID="$PUBLISHER_DID"
  else
    echo "WARNING: DID file is empty. Using default from env..."
  fi
else
  echo "WARNING: DID file not found at $DID_FILE. Using default from env..."
fi

echo "Starting social-app with FEED_OWNER_DID=${FEED_OWNER_DID}"
if [ -n "$ATP_DEFAULT_LABELER_DID" ]; then
  echo "Using default labeler: $ATP_DEFAULT_LABELER_DID"
fi
exec /usr/bin/bskyweb serve
