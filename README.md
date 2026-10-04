# Qwen Code #13178 — deterministic CLI evidence

Reproduction and verification for [issue #13178](https://github.com/QwenLM/qwen-code/issues/13178) and [PR #13315](https://github.com/QwenLM/qwen-code/pull/13315). This branch contains synthetic fixtures and real headless stdout/stderr recordings. The production patch remains on `fix/memory-index-entry-boundaries`; these artifacts are outside the upstream diff.

## Current formal source

Source `3347efdc8a34d52839abd513ff656e057d9e51cb`, based on `5ddfacc9d4c18d6e85faeed18786ada134774541`. The first review found a real CRLF boundary defect in initial submission `94c720b4`: splitting on LF left a CR on 150-code-unit entries, which lost their ordinary-entry priority. The follow-up normalizes line endings before counting and selection, shares the complete writer notice, and reports the actual UTF-16 units and 150-unit guidance.

The five final recordings below were executed again after the formal follow-up commit and final bundle. Each summary records clean tracked source, unchanged source hashes and bundle hashes before/after, main request index 1, three loopback requests, no timeout, and CLI/harness exit 0/0.

## Actual main system content

| Observation | Original baseline overlong | Current overlong | Current short |
| --- | --- | --- | --- |
| Oversized entry | Partial line, 25,000 UTF-16 code units | Omitted whole | Not in fixture |
| Later complete short link | Missing | Present | Present |
| Loading warning | Present | Present | Absent |

The original baseline tail was `AAAAAAAAA](notes/%`. The synthetic first line is 25,209 code units; total index size is 25,272. The short fixture is 62 units, 63 including trailing LF. A successful fake-model reply is not the correctness oracle: assertions inspect the actual serialized role=system content.

| Review boundary fixture | Actual complete retained IDs | Partial entries | Warning |
| --- | --- | --- | --- |
| LF, ordinary entry exactly 150 units | LONG0, ORDINARY, TAIL | None | Present |
| CRLF, same entry content | LONG0, ORDINARY, TAIL | None | Present |

Both long entries are 12,480 units; ORDINARY is 150 and TAIL is 30. The two newline encodings now retain the same complete entries. The original public-prompt reproduction on 94 retained LONG0/LONG1/TAIL for CRLF instead; its 16 helper captures are retained locally. That reproduction is distinguished from these actual CLI captures.

## Real recordings and assertions

- [Original before](before.cast) — 7.551 seconds.
- [Current overlong](final-after.cast) — 6.092 seconds.
- [Current short control](final-short-control.cast) — 6.254 seconds.
- [Current writer preservation](writer-control.cast) — 6.477 seconds.
- [Current LF 150 boundary](final-lf-150.cast) — 6.634 seconds.
- [Current CRLF 150 boundary](final-crlf-150.cast) — 6.211 seconds.

Companion `*-summary.json` and `*-system-evidence.json` files retain bundle/source identity and narrow assertions derived from the actual streamed main request. The casts are asciinema v2 with monotonic elapsed timestamps from real child stdout/stderr. They are headless streams, not interactive TUI captures. No recording was synthesized or retimed.

The public compiled writer control produces a 24,931-unit, 14-line body, with two long complete links and twelve ordinary entries. Its separate notice makes the full file 25,057 units. Both long entries and all twelve ordinary entries remain in the actual main system message. This guards a composition regression in the initial unpublished patch, repaired before submission. Legal-length path components are metadata only; no long destination files are created.

A separate actual writer control also confirms why under-budget notices remain meaningful: three legal topic inputs can produce only two retained entries, with a 23,245-unit final file. A small final file alone does not prove no entry was omitted. That counterexample is recorded locally and is not conflated with the near-cap CLI fixture.

## Run from this standalone evidence directory

Use Node >=22 and build/bundle the chosen worktree with its pinned dependencies. The original recorder remains available for the original before case:

```sh
node issue13178-record.mjs --bundle /absolute/baseline/dist/cli.js --expect before
node issue13178-review-round1-record.mjs --bundle /absolute/fixed/dist/cli.js --expect after
node issue13178-review-round1-record.mjs --bundle /absolute/fixed/dist/cli.js --expect after --fixture short
node issue13178-review-round1-record.mjs --bundle /absolute/fixed/dist/cli.js --expect after --fixture writer-notice
node issue13178-review-round1-record.mjs --bundle /absolute/fixed/dist/cli.js --expect after --fixture lf-150
node issue13178-review-round1-record.mjs --bundle /absolute/fixed/dist/cli.js --expect after --fixture crlf-150
```

Scripts create fresh synthetic HOME/settings/runtime/memory, start a random loopback fake provider, and spawn the real supplied bundle. The writer scenario locates the compiled writer through that bundle's worktree, so the full core build must exist. The new harness was additionally executed from this standalone directory for writer preservation. No model account or real API key is needed. A before recorder returning zero means it observed the expected broken content.

## Provenance and preserved history

- Original before source: `576689d07342dd2ba80d60ec00df23ea53251945`, including the prior writer retention fix.
- Original before bundle SHA256: `fcabd7df1f9ecd0315fd1d68acd49f532387f071add5c8661bc1757d76c29b62`.
- Current five final captures' bundle SHA256: `53b23628d14ef5de15a107e64c2ba9cc81df7ec97898a679bdf92811b0469e32`.
- Platform: Windows 11 10.0.26200 / Node 24.12.0 / pnpm 11.24.0.
- The original baseline full build had an implementation-time unused import failure. After restoring original reader/writer source, CLI workspace build and bundle completed, then the before capture ran. The current patch completed a separate full build, bundle, typecheck and lint.
- Initial unpublished `d350b677` captures remain in historical after/short files and immutable evidence commit `c39c50c11e7512e30a9287c4cc2a9bd3c9aad601`.
- Repaired pre-rebase `2c1f54c8` captures remain at `a4b46bc37333ca6a1837c0271b78792ca32b259a`; prior `51ae4a8c` at `b70be5d7fc4eb9f9df30eccbdd712df392208226`; initial formal `94c720b4` / `c8c1ced2` at `3bb4a9001963fcbecfc50199d9893a5765c583e0`. Their historical validations are not relabelled as current-source executions. The first short-fixture metadata error was corrected and the control genuinely rerun before publication.

## Limits and privacy

All memory is synthetic and all provider requests are loopback-only with a dummy key. Mock usage is not a tokenizer measurement. Only selected summaries, recordings and system assertions are tracked; raw request bodies, authentication headers, personal memory, credentials and full private logs are excluded.

This proves memory-input behavior in the built CLI. It does not prove real-model task success, macOS behavior, concurrent writes, compaction or recovery. Full local preflight failures and remote CI are reported separately in the PR.

## 中文说明

正式首轮审查修复为 3347efdc，五个 final 场景重新实录，bundle 为 53b23628。原始超长首行会截成半条路径并丢掉后一条短链接；当前整条省略超长项、保留短项，短索引无 warning。LF/CRLF 的同一 150 码元普通项现在都保留 LONG0/ORDINARY/TAIL，没有半条条目。真实 writer 控制保留两条完整长链接及十二条普通项；另一个小于预算的真实 writer 反例说明，省略提示不能仅因文件变小就删除。新脚本已从独立证据根执行 writer 控制，旧录像以历史 commit 保留。所有内容合成、请求仅 loopback，公开前做隐私扫描；mock usage 不是真实 token 数，这些录像也不表示全仓测试或远端 CI 全部通过。
