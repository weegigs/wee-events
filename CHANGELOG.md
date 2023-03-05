# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.18.2](https://github.com/weegigs/wee-events/compare/v0.18.1...v0.18.2) (2023-03-05)

**Note:** Version bump only for package @weegigs/events-monorepo

## [0.18.1](https://github.com/weegigs/wee-events/compare/v0.18.0...v0.18.1) (2023-03-05)

### Bug Fixes

- correct revision returned by memory store when publishing multiple events ([00d4c2e](https://github.com/weegigs/wee-events/commit/00d4c2e4030a4b6053f29c214bc859d8bfdc3e95))

# 0.18.0 (2023-02-24)

### Bug Fixes

- added timestamp to latest record in dynamo store ([ae64e4b](https://github.com/weegigs/wee-events/commit/ae64e4b34171e3a7ea4f73dfd393491ab9e80abc))
- bound load and publish to this in dynamo event store ([b594535](https://github.com/weegigs/wee-events/commit/b594535a17cad1567c8e5966725185d68cc880e1))
- correct depenencies ([97dfaab](https://github.com/weegigs/wee-events/commit/97dfaab70f4863b71b190f6be68bc75e72618803))
- correct dynamodb store retry behaviour ([eff790b](https://github.com/weegigs/wee-events/commit/eff790bcb582dbed39b358d2596b7c465e09d334))
- entity revision should be the same as the last event processed, not evaluated ([2334381](https://github.com/weegigs/wee-events/commit/2334381d21dcab8c052210a6af74da5af96b62dc))
- error when destructuring reducers for unknown events ([f0d08df](https://github.com/weegigs/wee-events/commit/f0d08dffa683f331e6f9c1d191e51a7ecce86b4f))
- example declared usage of incorrect event type ([d28bc59](https://github.com/weegigs/wee-events/commit/d28bc5917a4329a053c310f06cd546b32b91b3e1))
- removed #private fields ([dd828f9](https://github.com/weegigs/wee-events/commit/dd828f92771d11b63e2bf30184146d8dace00fff))
- revert nanoid to non-esmodule version ([3379e16](https://github.com/weegigs/wee-events/commit/3379e1631db6525a01f282fd3281947a6eedb02b))
- switch references from @weegigs/wee-events to @weegigs/events-core ([f3b5225](https://github.com/weegigs/wee-events/commit/f3b522550cc0f7f11a967893d6be61c716e08d4e))
- treat initial revision as not found ([edb5e00](https://github.com/weegigs/wee-events/commit/edb5e00d3ae2b00595f2a7acd13ecde792f83c50))
- updated noteServiced to notServiced ([b34abcd](https://github.com/weegigs/wee-events/commit/b34abcdbdc11930320da6987cba6774b9a5ad03a))

### Features

- added single command and creator dispatchers ([8c0ab66](https://github.com/weegigs/wee-events/commit/8c0ab66c3376abcd38adea39772a208ad43e1d74))
- align dynamo storage with golang implementation ([8e26129](https://github.com/weegigs/wee-events/commit/8e26129f757771653ea94301106ff1ef5e19cc7f))
- basic cli ([025435f](https://github.com/weegigs/wee-events/commit/025435fe7762f68df1b0b54ac0c5786dd90e97c7))
- create services from functions ([ede5dbe](https://github.com/weegigs/wee-events/commit/ede5dbe3148bc5457935f4c17c4bb0d98f74774f))
- effects based service definition ([59fbe04](https://github.com/weegigs/wee-events/commit/59fbe0433839f220f5f9cc5aa43d0dc78e7c0c19))
- fastify server generation ([27e0e25](https://github.com/weegigs/wee-events/commit/27e0e2507afa5cae310ab9c06e0cc7f01a9f1eeb))
