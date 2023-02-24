# Wee Events

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/518416c1092549ab858b18800ccef0e1)](https://www.codacy.com/gh/weegigs/wee-events/dashboard?utm_source=github.com&utm_medium=referral&utm_content=weegigs/wee-events&utm_campaign=Badge_Grade)

## Building `Wee Events`

### Prerequisites

The repository includes a nix file which includes system dependencies other than docker. If it's
useful for you "huzzah". Otherwise you'll need to ensure that the following are installed.

- Nodejs version 16.x
- PNPM
- Lerna
- Docker (for testing) https://www.testcontainers.org/supported_docker_environment/

### Building

Make sure you

```sh
pnpm install
pnpm build
```
