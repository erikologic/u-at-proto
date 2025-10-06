[![E2E Tests](https://github.com/eurosky-social/u-at-proto/actions/workflows/e2e-test.yml/badge.svg)](https://github.com/eurosky-social/u-at-proto/actions/workflows/e2e-test.yml)

# u-at-proto

**One-click, production-like ATProto network for local development and E2E testing.**

This project provides a complete, production-like AT Protocol network running locally with Docker Compose. It's designed to be the reference implementation for developers building on ATProto who need a reliable local environment with comprehensive E2E test coverage.

## Why This Project?

Building ATProto applications requires a complete network stack. This project solves common pain points:

- ✅ **Zero Manual Configuration** - `docker compose up` brings up the whole stack, `docker compose down -v` to clean up any test artifacts
- ✅ **Production-Like Environment** - Real HTTPS certificates via Let's Encrypt (using Cloudflare DNS)
- ✅ **Private separate network** - Uses Tailscale to set up a private network, to be shared with distributed test clients.
- ✅ **Comprehensive Test Suite Boilercode** - API tests (Jest) + Browser tests (Playwright)
- ✅ **E2E Test Reference** - Canonical examples of testing ATProto applications
- ✅ **CI/CD Ready** - GitHub Actions workflows with artifact publishing

## Project Structure

This project uses a modular Docker Compose architecture. Each service is self-contained in its own directory with its compose configuration and supporting files.

### Service Dependencies

Services start in dependency order with health checks:

```
traefik → database → plc → pds → relay → relay-post-setup
                                      ↓
                                  feedgen → feedgen-post-setup → social
                                      ↓
                                  jetstream
                                      ↓
                                  bsky (AppView)
```

Post-setup services run initialization scripts after their base service is healthy, e.g.:

- `relay-post-setup` - Requests relay to crawl the PDS
- `feedgen-post-setup` - Creates feedgen account and publishes feed to PDS

### Core ATProto Services

- **PLC** (`plc/`) - DID registry for decentralized identity
- **PDS** (`pds/`) - Personal Data Server (user accounts and data)
- **Relay** (`relay/`) - Firehose for real-time event streaming
- **Jetstream** (`relay/`) - Filtered event stream consumer
- **AppView** (`appview/`) - Social graph and feed aggregation (Bsky)
- **Ozone** (`moderation/`) - Moderation and labeling service
- **Feed Generator** (`feedgen/`) - Custom algorithmic feed with auto-DID injection
- **Social App** (`social/`) - Official Bluesky web client

### Infrastructure

- **Tailscale** (`traefik/`) - Secure mesh VPN for remote access
- **Cloudflare** (`traefik/`) - DNS management / SSL certificate provisioning
- **Traefik** (`traefik/`) - Reverse proxy with automatic HTTPS (Let's Encrypt)
- **PostgreSQL** (`database/`) - Shared database for services
- **Redis** (`appview/`) - Caching and session storage
- **OTel collector** (`observability/`) - Telemetry collection (optional, use `--profile otel`)

### Testing

- **Jest E2E Tests** (`tests/api/`) - API-level validation of ATProto services
- **Playwright E2E Tests** (`tests/ui/`) - Browser-based user interaction flows
- **GitHub Actions** (`.github/workflows/`) - Automated CI/CD with test artifact publishing

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Cloudflare domain with DNS API access for SSL certificates via Let's Encrypt
- Tailscale account for Tailscale network integration
- Optional: Node.js 22+ for local test execution (tests can be run from the containers)

### 1. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and configure:

- `DOMAIN` - Your domain name (e.g., `example.com`)
- `PARTITION` - Environment logical partition (e.g., `local`, `staging`)
- `CF_API_EMAIL` - Cloudflare account email
- `CF_DNS_API_TOKEN` - Cloudflare DNS API token (for Let's Encrypt DNS challenge)
- `TAILSCALE_CLIENT_SECRET` / `TS_TAG` - Tailscale OAuth client secret and tag

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
- Ozone: `https://ozone.{PARTITION}.{DOMAIN}`

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

**Playwright Reports on GitHub Pages**

The `deploy_pages.yml` workflow automatically:

- Collects all test run artifacts
- Generates browsable index
- Deploys to GitHub Pages e.g. <https://eurosky-social.github.io/u-at-proto/artifacts/>

**Setup:**

1. Repository Settings → Pages → Source: "GitHub Actions"
2. Reports available at: `https://<username>.github.io/<repo>/artifacts/e2e-tests/`

Each test run contains:

- HTML report with test results
- Videos of test execution
- Screenshots
- Playwright traces

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

## Working with Individual Services

### Starting/Stopping Services

```bash
# Start all services
docker compose up -d

# Start specific service and its dependencies
docker compose up -d social

# Stop specific service
docker compose stop social

# Restart specific service
docker compose restart social

# View logs for specific service
docker compose logs -f social
```

### Modifying Service Configuration

Each service's configuration is in its own folder. To modify a service:

1. Edit the service's `compose.yml` in its directory (e.g., `relay/compose.yml`)
2. Restart the service: `docker compose up -d relay`

Files are mounted relatively from each service directory, so paths like `./post-setup.sh` refer to files within that service's folder.

### Adding Your Own Services

To add a new service to the stack:

1. Create a new directory (e.g., `myservice/`)
2. Add `myservice/compose.yml` with your service definition
3. Include it in the main `docker-compose.yml`:

   ```yaml
   include:
     - myservice/compose.yml
   ```

4. Start: `docker compose up -d myservice`

### Using as a Git Submodule

You can include this project as a submodule in your own repository to use the ATProto services:

**1. Add as submodule:**

```bash
git submodule add https://github.com/eurosky-social/u-at-proto.git u-at-proto
git submodule update --init --recursive
```

**2. Create your project's `docker-compose.yml`:**

```yaml
include:
  # Include only the services you need, e.g.
  - atproto/traefik/compose.yml
  - u-at-proto/database/compose.yml
  - u-at-proto/plc/compose.yml
  - u-at-proto/pds/compose.yml
  - u-at-proto/relay/compose.yml

  # Add your own services
  - ./compose.yml

# You can also override or extend services here
services:
  myapp:
    # your custom service configuration
```

**3. Create your `.env` file:**

```bash
# Copy example and configure
cp u-at-proto/.env.example .env
# Edit .env with your configuration
```

**4. Start your stack:**

```bash
docker compose up -d
```

**5. Keeping Updated:**
Pull the submodule:

```bash
git submodule update --remote
```

## Useful Commands

```bash
# View all service logs
docker compose logs -f

# View specific service with timestamps
docker compose logs -f --timestamps social

# Restart specific service
docker compose restart social

# Rebuild and restart after code changes
docker compose up -d --build social

# Connect to PostgreSQL
docker compose exec postgres psql -U postgres

# Clean restart (removes all data)
docker compose down -v && docker compose up -d --wait

# Start with observability enabled
docker compose --profile o11y up -d
```

## Credits

- [Bluesky](https://github.com/bluesky-social) for ATProto reference implementations
- [SmokeSignal](https://tangled.org/@smokesignal.events/localdev) for Tailscale + TLS inspiration
- [ZeppelinSocial](https://github.com/zeppelin-social/bluesky-appview) for inspiration on how to get the BSky AppView running

## License

MIT
