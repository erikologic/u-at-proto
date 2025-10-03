#!/bin/sh
set -e

# Fix the incorrect path in start.sh using awk (more portable than sed -i)
awk '{gsub(/dist\/index\.js/, "dist/src/index.js")}1' /app/start.sh > /tmp/start-fixed.sh
chmod +x /tmp/start-fixed.sh

# Execute the fixed start script
exec /tmp/start-fixed.sh
