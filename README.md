[![E2E Tests](https://github.com/erikologic/u-at-proto/actions/workflows/e2e-test.yml/badge.svg)](https://github.com/erikologic/u-at-proto/actions/workflows/e2e-test.yml)

# ATProto Local Network

A canonical, production-ready implementation of the AT Protocol stack for local development and testing. This project provides a complete ATProto environment with all services configured and ready to use.

## What's Included

A fully functional ATProto network with:

- **PLC** - DID registry service
- **PDS** - Personal Data Server for user data
- **Relay** - Firehose relay for real-time events
- **Jetstream** - Streaming service for filtered events
- **Ozone** - Moderation service
- **Bsky** - AppView service for social features
- **Feed Generator** - Custom algorithmic feed with automatic DID injection
- **Social App** - Official Bluesky web frontend
- **Traefik** - Reverse proxy with automatic HTTPS via Let's Encrypt
- **Comprehensive E2E Tests** - Both API (Jest) and browser (Playwright) tests

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Tailscale account (for HTTPS support)
- Node.js 22+ (for local test execution)

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `TS_AUTHKEY` - Tailscale auth key
- `DOMAIN` - Your Tailscale domain
- `CF_API_EMAIL` - Cloudflare email
- `CF_DNS_API_TOKEN` - Cloudflare DNS API token

### 2. Start Services

```bash
docker compose up -d --wait
```

All services start with health checks and dependency ordering.

### 3. Verify Deployment

```bash
docker compose ps
```

Access services at:
- Social App: `https://social.{DOMAIN}`
- Bsky AppView: `https://bsky.{DOMAIN}`
- PDS: `https://pds.{DOMAIN}`
- Feed Generator: `https://feedgen.{DOMAIN}`

## Running Tests

### Complete Test Suite

```bash
# Tear down, rebuild, and test everything
docker compose down -v
docker compose up -d --wait
docker compose --profile test up --abort-on-container-exit
```

This runs:
1. **Jest** - API-level tests validating PDS, Relay, Jetstream, Bsky
2. **Playwright** - Browser tests validating the Social App UI

### Individual Test Suites

**Jest (API Tests)**
```bash
# Local
npm test

# Docker (recommended)
docker compose --profile test up e2e-jest --abort-on-container-exit
```

**Playwright (Browser Tests)**
```bash
# Local (requires Playwright installed)
npm run test:browser

# Docker (recommended - matches CI)
docker compose --profile test up e2e-playwright --abort-on-container-exit
```

**Playwright Development**
```bash
npm run test:browser:ui       # Interactive UI mode
npm run test:browser:headed   # See browser in action
npm run playwright:codegen    # Generate test code
```

## Observing Results

### Local Testing

**Test Output**
- Jest results print to console
- Playwright results in `./playwright-report/` (HTML report)
- Test videos in `./test-results/` (CI mode only)

**Service Logs**
```bash
docker compose logs -f              # All services
docker compose logs -f social       # Specific service
docker compose logs --tail 50 bsky  # Last 50 lines
```

**Service Status**
```bash
docker compose ps                   # Health status
docker compose top                  # Process info
```

### CI/CD (GitHub Actions)

The workflow automatically runs on every push to `main`:

**E2E Tests Workflow** (`.github/workflows/e2e-test.yml`)
1. Connects to Tailscale network
2. Restores SSL certificates from cache
3. Starts all ATProto services
4. Runs Jest tests
5. Runs Playwright tests with video recording
6. Uploads Playwright artifacts
7. Updates SSL certificate cache

**View Results:**
- Go to Actions tab in GitHub
- Click on latest workflow run
- See test results in job logs
- Download Playwright artifacts from workflow summary

**Playwright Reports on GitHub Pages**

The `deploy_pages.yml` workflow automatically:
- Collects all test run artifacts
- Generates browsable index
- Deploys to GitHub Pages

**Setup:**
1. Repository Settings → Pages → Source: "GitHub Actions"
2. Reports available at: `https://<username>.github.io/<repo>/artifacts/e2e-tests/`

Each test run contains:
- HTML report with test results
- Videos of test execution
- Screenshots
- Playwright traces

## Architecture Highlights

### Dynamic Feed Generator DID

The feed generator automatically:
1. Creates a user account on PDS
2. Publishes the feed generator
3. Writes the publisher DID to a shared volume
4. Social app reads the DID on startup
5. Feed becomes immediately available in the UI

No manual DID configuration needed - tear down and rebuild anytime.

### SSL Certificate Management

- **Local**: Traefik + Let's Encrypt with automatic HTTPS
- **CI**: Encrypted certificate caching to avoid rate limits
- **Tailscale**: MagicDNS for service discovery

### Test Standardization

Both local and CI use identical Docker images:
- Jest: `node:22-alpine`
- Playwright: `mcr.microsoft.com/playwright:v1.49.1-noble`

Ensures consistent behavior across environments.

## GitHub Secrets Required

Add to Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `TS_AUTHKEY` | Tailscale authentication key |
| `DOMAIN` | Your Tailscale domain (e.g., `ts.example.com`) |
| `CF_API_EMAIL` | Cloudflare account email |
| `CF_DNS_API_TOKEN` | Cloudflare DNS API token |
| `CERT_ENCRYPTION_KEY` | Random string for certificate encryption |

## Useful Commands

```bash
# View all service logs
docker compose logs -f

# Restart specific service
docker compose restart social

# Connect to PostgreSQL
docker compose exec postgres psql -U postgres

# Clean restart (removes all data)
docker compose down -v && docker compose up -d

# Check feedgen DID
cat /path/to/volume/publisher-did.txt
docker compose exec feedgen cat /shared/publisher-did.txt

# Query feed directly
curl "https://bsky.{DOMAIN}/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:{DID}/app.bsky.feed.generator/whats-hot"
```

## Credits

- [Bluesky](https://github.com/bluesky-social) for ATProto reference implementations
- [SmokeSignal](https://tangled.org/@smokesignal.events/localdev) for Tailscale + TLS inspiration

## License

MIT
