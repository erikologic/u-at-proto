[![E2E Tests](https://github.com/erikologic/u-at-proto/actions/workflows/e2e-test.yml/badge.svg)](https://github.com/erikologic/u-at-proto/actions/workflows/e2e-test.yml)

# Your UAT AT environment

This project provides a complete UAT (User Acceptance Testing) environment for the AT Protocol ecosystem. It sets up a full ATProtocol network including PLC directory, Personal Data Server (PDS), and Relay services, accessible through Tailscale for secure networking.

## Credits

The SmokeSignal team for lots of inspiration around using Tailscale to for TLS support: https://tangled.org/@smokesignal.events/localdev

## Architecture

The environment consists of these core services:

- **PostgreSQL**: Shared database for all AT Protocol services
- **PLC Server**: DID PLC Directory Service for decentralized identity
- **PDS Server**: Personal Data Server for user data and content
- **Relay Server**: Real-time message relay for the AT Protocol firehose

Each service is exposed through Tailscale with automatic SSL certificate management via Caddy.

## Prerequisites

- Docker and Docker Compose
- Tailscale (running on the host)
- GHA for CI

### Service URLs

- PLC: `https://plc-{PARTITION}.{TAILSCALE_DOMAIN}`
- PDS: `https://pds-{PARTITION}.{TAILSCALE_DOMAIN}`
- Relay: `https://relay-{PARTITION}.{TAILSCALE_DOMAIN}`
- Jetstream: `https://jetstream-{PARTITION}.{TAILSCALE_DOMAIN}`

Those will appear in your Tailscale dashboard too.

## Local Setup

1. **Set up Tailscale OAuth credentials**:
   - Visit [Tailscale Admin Console](https://login.tailscale.com/admin/settings/oauth)
   - Create OAuth client with appropriate scopes
   - Note your client ID and secret

2. **Configure environment variables**:

   ```bash
   cp .env.example .env
   ```

   Edit the .env file

3. **Start the environment**:

   ```bash
   docker compose up -d
   ```

4. **Verify services are healthy**:

   ```bash
   docker compose ps
   ```

5. **Run E2E tests**:

   ```bash
   docker compose run --rm e2e-tests
   ```

## CI/CD Setup (GitHub Actions)

### Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `TAILSCALE_CLIENT_ID` | OAuth client ID from Tailscale |
| `TAILSCALE_CLIENT_SECRET` | OAuth secret from Tailscale |
| `TAILSCALE_DOMAIN` | Your Tailscale domain |
| `CERT_ENCRYPTION_KEY` | Random key for SSL certificate caching |

### Workflow Configuration

The CI workflow (`e2e-test.yml`) automatically:

1. Connects to your Tailscale network
2. Restores/caches SSL certificates
3. Starts all services
4. Runs E2E tests
5. Saves updated certificates

The workflow runs on every push to `main` branch.

## Running Tests

These projects demo how to integrate a test suite with the docker compose setup.  
By default no E2E tests are run.
Tests can be run with:

```bash
docker compose --profile test run --rm e2e-tests
```

### Test Scenarios

The E2E tests validate:

- Content posting

## Useful Commands

```bash
# View all service logs
docker compose logs -f

# Restart specific service
docker compose restart pds

# Connect to PostgreSQL
docker compose exec postgres psql -U postgres

# Clean restart (removes all data)
docker compose down -v && docker compose up -d

# Check Tailscale status
docker compose exec pds-tailscale tailscale status
```
