# Changelog

All notable changes to this project will be documented in this file.

* chore: add force release commands for overriding version detection (788453b)
* chore: replace unreliable dry-run with reliable preview command (e2c8147)

## [0.19.0](https://github.com/weegigs/wee-events/compare/v0.18.4...v0.19.0) (2025-06-30)


### Features

* add Vitest configuration with testcontainers support ([85fbc0e](https://github.com/weegigs/wee-events/commit/85fbc0e0f4426f1fa8f2108c774f26c824712458))
* enhance NatsClient to support customizable request options for execute and fetch methods ([76d0d42](https://github.com/weegigs/wee-events/commit/76d0d4266d354c6db1db1d78e46b260fcf4b3074))
* **errors:** introduce serializable error framework ([d464dbd](https://github.com/weegigs/wee-events/commit/d464dbdd6d61d6a8dafc6f4e0ee87e3260ad386c))
* implement new NATS package with client/server architecture and add common function tests ([4bf28ac](https://github.com/weegigs/wee-events/commit/4bf28acc99052cfa07ea1fc2824263b63a3e507a))
* **nats:** consolidate command endpoints to single endpoint ([6995d7f](https://github.com/weegigs/wee-events/commit/6995d7f5fa1411c98b44688be60135b0b29a951a))


### Bug Fixes

* enhance release process with dynamic version tagging and improved package verification ([9b9c9ca](https://github.com/weegigs/wee-events/commit/9b9c9ca30db9c363cae156029262ee9f22a4a839))
* **eslint:** was failing with ([58534b6](https://github.com/weegigs/wee-events/commit/58534b6ed24ecfd6e971a9b81d52cb8b0e7d8afb))
* remove generated js and ts.d files ([56cbb9b](https://github.com/weegigs/wee-events/commit/56cbb9b5cf1812c708dc2b5e1d2b640c0a7b01c4))
* **tsconfig:** correct reference path for common package ([185c9de](https://github.com/weegigs/wee-events/commit/185c9deb3f125fa5475d1956e1c01dbdba245d87))
* **turbo:** allow TESTCONTAINERS_* env vars to be passed over when ([390d923](https://github.com/weegigs/wee-events/commit/390d92338cdcdfe24e07419cd176342775132fa0))
* **typo:** I swear I ran the tests after rebasing. Anyway, fixing the ([e48c2f7](https://github.com/weegigs/wee-events/commit/e48c2f7358c749b41c5b69608a3d1755f27d335e))


### Reverts

* Revert "hack(docker): I need to look into why I can't run this test in podman," ([3aa0c1d](https://github.com/weegigs/wee-events/commit/3aa0c1d815b351734a30869cd86bbf459cd93d3a))
