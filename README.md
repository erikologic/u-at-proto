[![E2E Tests](https://github.com/erikologic/u-at-proto/actions/workflows/e2e-test.yml/badge.svg)](https://github.com/erikologic/u-at-proto/actions/workflows/e2e-test.yml)

# u-at-proto

**One-click, production-like ATProto network for local development and E2E testing.**

This project provides a complete, production-like AT Protocol network running locally with Docker Compose. It's designed to be the reference implementation for developers building on ATProto who need a reliable local environment with comprehensive E2E test coverage.

## Why This Project?

Building ATProto applications requires a complete network stack. This project solves common pain points:

✅ **Zero Manual Configuration** - All services auto-configure and discover each other
✅ **Production-Like Environment** - Real HTTPS certificates via Let's Encrypt + Tailscale
✅ **Comprehensive Test Suite** - API tests (Jest) + Browser tests (Playwright)
✅ **E2E Test Reference** - Canonical examples of testing ATProto applications
✅ **CI/CD Ready** - GitHub Actions workflows with artifact publishing

## Components

### Core ATProto Services

- **PLC** - DID registry for decentralized identity
- **PDS** - Personal Data Server (user accounts and data)
- **Relay** - Firehose for real-time event streaming
- **Jetstream** - Filtered event stream consumer
- **AppView (Bsky)** - Social graph and feed aggregation
- **Ozone** - Moderation and labeling service

### Application Layer

- **Feed Generator** - Custom algorithmic feed with auto-DID injection
- **Social App** - Official Bluesky web client

### Infrastructure

- **Tailscale** - Secure mesh VPN for remote access
- **Cloudflare** - DNS management / SSL certificate provisioning / Tunneling (todo)
- **Traefik** - Reverse proxy with automatic HTTPS (Let's Encrypt)
- **PostgreSQL** - Shared database for services
- **Redis** - Caching and session storage

### Testing

- **Jest E2E Tests** - API-level validation of ATProto services
- **Playwright E2E Tests** - Browser-based user interaction flows
- **GitHub Actions** - Automated CI/CD with test artifact publishing

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Cloudflare domain with DNS API access (for SSL certificates via Let's Encrypt)
- Tailscale account (for Tailscale network integration)
- Node.js 22+ (for local test execution)

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DOMAIN` - Your domain name (e.g., `example.com`)
- `PARTITION` - Environment logical partition (e.g., `local`, `staging`)
- `CF_API_EMAIL` - Cloudflare account email
- `CF_DNS_API_TOKEN` - Cloudflare DNS API token (for Let's Encrypt DNS challenge)
- `TAILSCALE_CLIENT_SECRET` / `TS_TAG` - Tailscale OAuth client secret and tag (optional)

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
- Social App: `https://social.{PARTITION}.{DOMAIN}`
- Bsky AppView: `https://bsky.{PARTITION}.{DOMAIN}`
- PDS: `https://pds.{PARTITION}.{DOMAIN}`
- Relay: `https://relay.{PARTITION}.{DOMAIN}`
- Jetstream: `https://jetstream.{PARTITION}.{DOMAIN}`
- Feed Generator: `https://feedgen.{PARTITION}.{DOMAIN}`

## Running Tests

### Complete Test Suite

```bash
# Tear down the env clean, rebuild, and test everything
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


## GitHub Secrets Required

Add to Settings → Secrets and variables → Actions:

| Secret | Description |
|--------|-------------|
| `DOMAIN` | Your domain name (e.g., `example.com`) |
| `PARTITION` | Environment partition (e.g., `ci`, `staging`) |
| `CF_API_EMAIL` | Cloudflare account email |
| `CF_DNS_API_TOKEN` | Cloudflare DNS API token (for Let's Encrypt DNS challenge) |
| `CERT_ENCRYPTION_KEY` | Random string for certificate encryption |
| `TS_CLIENT_SECRET` | Tailscale OAuth client secret |
| `TS_TAG` | Tailscale tag |

## Useful Commands

```bash
# View all service logs
docker compose logs -f

# Restart specific service
docker compose restart social

# Connect to PostgreSQL
docker compose exec postgres psql -U postgres

# Clean restart (removes all data)
docker compose down -v && docker compose up -d --wait

# Check feedgen DID
cat /path/to/volume/publisher-did.txt
docker compose exec feedgen cat /shared/publisher-did.txt

# Query feed directly
curl "https://bsky.{PARTITION}.{DOMAIN}/xrpc/app.bsky.feed.getFeed?feed=at://did:plc:{DID}/app.bsky.feed.generator/whats-hot"
```

## Credits

- [Bluesky](https://github.com/bluesky-social) for ATProto reference implementations
- [SmokeSignal](https://tangled.org/@smokesignal.events/localdev) for Tailscale + TLS inspiration

## License

MIT
