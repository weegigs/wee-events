# Wee Events

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/518416c1092549ab858b18800ccef0e1)](https://www.codacy.com/gh/weegigs/wee-events/dashboard?utm_source=github.com&utm_medium=referral&utm_content=weegigs/wee-events&utm_campaign=Badge_Grade)

## Building `Wee Events`

### Prerequisites

The repository includes a nix file which includes system dependencies other than docker. If it's
useful for you "huzzah". Otherwise you'll need to ensure that the following are installed.

- Nodejs version 18.x
- PNPM
- Lerna
- Docker (for testing) https://www.testcontainers.org/supported_docker_environment/

### Building

Make sure you install

```sh
pnpm install
pnpm build
```

## Future Work

### Examples

There is a distinct lack of examples in the project, and no tutorial.

### TSEffect Alternative

TSEffect provides a useful model for managing dependencies and errors. Unfortunately it works best in a "turtles all the way down"
environment, especially when it comes to errors. This means that random throws in included code will, if you're not careful, lead
to unexpected results.
