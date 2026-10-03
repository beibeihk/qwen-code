# Qwen Code #13178 — deterministic CLI evidence

Reproduction and verification for [QwenLM/qwen-code issue #13178](https://github.com/QwenLM/qwen-code/issues/13178). This branch contains only synthetic test material and real headless stdout/stderr recordings. The production patch is kept on `fix/memory-index-entry-boundaries`; this evidence is not part of the upstream diff.

## Observed main request

| Actual role=system content | Before | After | Short control |
| --- | --- | --- | --- |
| Oversized entry | Partial line, 25,000 UTF-16 code units | Omitted whole | Not in fixture |
| Later complete short entry | Missing | Present | Present |
| Truncation warning | Present | Present | Absent |
| CLI exit / harness exit | 0 / 0 | 0 / 0 | 0 / 0 |
| Request inspected | Streamed main, index 1 | Streamed main, index 1 | Streamed main, index 1 |

The baseline tail was `AAAAAAAAA](notes/%`. The fix does not shorten that target: it omits the entry and keeps the later short link. Successful fake-model replies are not the correctness oracle; the assertions inspect the actual serialized main system message.

The synthetic overlong fixture has a 25,209-code-unit first line and 25,272-code-unit total index. The short fixture has a 62-code-unit first line and 63 total including its trailing newline. This represents a hand-maintained index, not ordinary writer-generated output.

## Real terminal recordings

- [Before](before.cast) — approximately 7.551 seconds.
- [After](after.cast) — approximately 8.068 seconds.
- [Short control](short-control.cast) — approximately 7.568 seconds.

These are asciinema v2 files containing the actual test process stdout/stderr with monotonic elapsed timestamps. They are headless terminal streams, not an interactive TUI capture. A baseline recorder returning zero means it observed the expected broken content.

The companion [before summary](before-summary.json), [after summary](after-summary.json), [short-control summary](short-control-summary.json) and system-only evidence files retain concrete assertions and bundle identity. The initial short-control metadata referenced the wrong fixture length; it was corrected and the short control was genuinely rerun. The published recording is that final run.

## Run against a built bundle

Use Node >=22. Build/bundle the target worktree using its pinned dependencies, then run these scripts from this evidence directory:

```sh
node issue13178-record.mjs --bundle /absolute/path/to/baseline/dist/cli.js --expect before
node issue13178-record.mjs --bundle /absolute/path/to/fixed/dist/cli.js --expect after
node issue13178-record.mjs --bundle /absolute/path/to/fixed/dist/cli.js --expect after --fixture short
```

The scripts create isolated synthetic HOME, settings, runtime and memory paths under their own evidence folder, start a loopback fake OpenAI-compatible provider, and spawn the actual bundle. No model account or real API key is needed. A normal small index is a positive control.

## Provenance

- Source baseline: `576689d07342dd2ba80d60ec00df23ea53251945`, including the prior writer retention fix.
- Before bundle SHA256: `fcabd7df1f9ecd0315fd1d68acd49f532387f071add5c8661bc1757d76c29b62`.
- After bundle SHA256: `d350b6770be8de13c2b723d92df783d05f2fe3da3a3a0c30676312ac211ba972`.
- Local platform: Windows 11 10.0.26200, Node 24.12.0, pnpm 11.24.0.
- The original baseline full build was not counted as successful: an implementation-time unused import failed its later CLI phase. Baseline reader/writer source was restored, CLI workspace build and bundle completed, and then the before capture ran. The final patch completed a separate full build and bundle.

## Limits and privacy

Every provider request uses a random loopback port, a dummy key and synthetic memory. Recorded usage is supplied by the mock and is not a real tokenizer measurement. Authentication headers, real personal memory, credentials and full local validation logs are not published here.

This proves the bundle's memory-input behavior. It does not prove task success with a real model, cross-platform behavior, concurrency safety or compaction/recovery semantics. Full local preflight results and any failures are reported separately in the PR. The recordings do not imply that all repository tests passed.

## 中文说明

本证据分支只包含合成内存 fixture、可复跑的本地 mock 脚本、真实时间的 headless 终端录像和实际 main request 的 system 内容检查。修复前截到半条链接并丢掉后一条短链接；修复后整条跳过超长项，完整保留短链接，warning 仍有；普通短索引没有 warning。mock usage 不是实际 token 数，不使用真实凭据或个人记忆，也不表示全仓测试全部通过。
