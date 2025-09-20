# Local AT Protocol Development Environment

This Docker Compose setup provides a local development environment for AT Protocol services.

## Services

- **PostgreSQL**: Shared database instance for all AT Protocol services
- **PLC Server**: DID PLC Directory Service
- **PDS Server**: Personal Data Server
- **Relay Server**: Real-time message relay service
- **AT Protocol Test**: Automated test that verifies PDS-to-Relay communication

## Getting Started

1. Start the services:

   ```bash
   docker compose up -d
   ```

2. Check service health:

   ```bash
   docker compose ps
   ```

3. View logs:

   ```bash
   docker compose logs -f plc
   ```

4. Connect to PostgreSQL:

   ```bash
   docker compose exec postgres psql -U atproto -d atproto
   ```

5. Stop the services, remove the containers, and clean up volumes and images (deletes databases and files):

   ```bash
   docker-compose down -v
   ```

6. Stop the services and remove containers (keeps databases and files for later use):

   ```bash
   docker-compose down
   ```

## Testing

The setup includes an automated test (`atproto-test` service) that:

1. Connects to the relay WebSocket to listen for events
2. Creates two test users on the PDS (`alice.test` and `bob.test`)
3. Posts content from both users (2 posts each)
4. Verifies that events are received through the relay
5. Reports success/failure

### Running the test

The test runs automatically after all services are healthy and the relay-subscriber has completed:

```bash
docker compose up
```

To run the test manually:

```bash
npm install
node test_pds_relay.mjs
```

### Test output

The test provides detailed logging showing:

- Relay connection status
- User creation and login
- Post creation
- Event reception from relay
- Final test results

## Connecting to the services

Services can be accessed by any machine connected to the same Tailscale network using: `<service>.<TAILSCALE_DOMAIN>` (e.g. `pds.tail0123.ts.net`).
