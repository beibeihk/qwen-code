# Qwen Code #13178 — deterministic CLI evidence

Reproduction and verification for [QwenLM/qwen-code issue #13178](https://github.com/QwenLM/qwen-code/issues/13178). This branch contains only synthetic test material and real headless stdout/stderr recordings. The production patch is kept on `fix/memory-index-entry-boundaries`; this evidence is not part of the upstream diff.

## Final observed main request

| Actual role=system content | Baseline before | Final after | Final short control |
| --- | --- | --- | --- |
| Oversized entry | Partial line, 25,000 UTF-16 code units | Omitted whole | Not in fixture |
| Later complete short entry | Missing | Present | Present |
| Truncation warning | Present | Present | Absent |
| CLI exit / harness exit | 0 / 0 | 0 / 0 | 0 / 0 |
| Request inspected | Streamed main, index 1 | Streamed main, index 1 | Streamed main, index 1 |

The baseline tail was `AAAAAAAAA](notes/%`. The fix does not shorten that target: it omits the entry and keeps the later short link. Successful fake-model replies are not the correctness oracle; the assertions inspect the actual serialized main system message.

The synthetic overlong fixture has a 25,209-code-unit first line and 25,272-code-unit total index. The short fixture has a 62-code-unit first line and 63 total including its trailing newline. This represents a hand-maintained index, not ordinary writer-generated output.

## Final real terminal recordings

- [Before](before.cast) — approximately 7.551 seconds.
- [Final after](final-after.cast) — approximately 7.452 seconds.
- [Final short control](final-short-control.cast) — approximately 8.416 seconds.
- [Generated-index preservation control](writer-control.cast) — approximately 8.060 seconds; also verifies the standalone harness against the compiled writer identified by the supplied bundle.

These are asciinema v2 files containing the actual test process stdout/stderr with monotonic elapsed timestamps. They are headless terminal streams, not an interactive TUI capture. A baseline recorder returning zero means it observed the expected broken content.

The companion [before summary](before-summary.json), [final after summary](final-after-summary.json), [final short summary](final-short-control-summary.json), [writer control summary](writer-control-summary.json) and system-only evidence files retain concrete assertions and bundle identity. Original `after.cast`, `short-control.cast` and their summaries are preserved as historical captures of the initial unpublished patch (`d350b677…`), not the final patch. Their earlier immutable publication is commit `c39c50c11e7512e30a9287c4cc2a9bd3c9aad601`; the repaired pre-rebase `2c1f54c8` / `ab32dfb…` captures remain at immutable commit `a4b46bc37333ca6a1837c0271b78792ca32b259a`. After the last upstream rebase and build, all three controls were actually recorded again against `51ae4a8c` / `63b21b6f…`; the current final files contain those new recordings. The initial short-control metadata referenced the wrong fixture length; it was corrected and the short control was genuinely rerun before the first publication. No recording has been synthesized or retimed.

## Writer-to-reader preservation control

The public compiled writer produces a 24,931-code-unit, 14-line body with two long complete links and twelve ordinary entries. Its separate truncation notice brings the full file to 25,057 code units. The final actual main system message keeps both long entries and all twelve ordinary entries; the reader's existing loading warning remains. This is a preservation control, not a second upstream bug. An independent review found a notice-composition regression in our initial unpublished fix; it was repaired before submission. The fixture uses legal-length path components in document metadata and creates no long destination files.

## Run against a built bundle

Use Node >=22. Build/bundle the target worktree using its pinned dependencies, then run these scripts from this evidence directory:

```sh
node issue13178-record.mjs --bundle /absolute/path/to/baseline/dist/cli.js --expect before
node issue13178-record.mjs --bundle /absolute/path/to/fixed/dist/cli.js --expect after
node issue13178-record.mjs --bundle /absolute/path/to/fixed/dist/cli.js --expect after --fixture short
node issue13178-record.mjs --bundle /absolute/path/to/fixed/dist/cli.js --expect after --fixture writer-notice
```

The four scripts create isolated synthetic HOME, settings, runtime and memory paths under their own evidence folder, start a loopback fake OpenAI-compatible provider, and spawn the actual bundle. The writer control additionally imports the compiled core writer from the worktree identified by the bundle; the full build must be present. No model account or real API key is needed. A normal small index is a positive control.

## Provenance

- Original before source baseline: `576689d07342dd2ba80d60ec00df23ea53251945`, including the prior writer retention fix.
- Final source commit: `51ae4a8cc8efd5c5ba6be552668a4e9d39b5444c`, rebased on `eb0b79c5b87d781cddc65c28e70955404eb928d3`. Independent raw-blob comparison confirmed that the relevant original memory source and documentation are identical at the original, f05 and eb0 baselines. The six patched file blobs are identical between reviewed `2c1f54c8` and submitted `51ae4a8c`; the last upstream commit affects a separate managed-agent E2E runner.
- Before bundle SHA256: `fcabd7df1f9ecd0315fd1d68acd49f532387f071add5c8661bc1757d76c29b62`.
- Final after / short / writer-control bundle SHA256: `63b21b6ff70be8515f88f6674296f0108820789cb084fe6890cda0d6890b911e`.
- Local platform: Windows 11 10.0.26200, Node 24.12.0, pnpm 11.24.0.
- The original baseline full build was not counted as successful: an implementation-time unused import failed its later CLI phase. Baseline reader/writer source was restored, CLI workspace build and bundle completed, and then the before capture ran. The final patch completed a separate full build and bundle.

## Limits and privacy

Every provider request uses a random loopback port, a dummy key and synthetic memory. Recorded usage is supplied by the mock and is not a real tokenizer measurement. Authentication headers, real personal memory, credentials and full local validation logs are not published here.

This proves the bundle's memory-input behavior. It does not prove task success with a real model, cross-platform behavior, concurrency safety or compaction/recovery semantics. Full local preflight results and any failures are reported separately in the PR. The recordings do not imply that all repository tests passed.

## 中文说明

本证据分支只包含合成内存 fixture、可复跑的本地 mock 脚本、真实时间的 headless 终端录像和实际 main request 的 system 内容检查。修复前截到半条链接并丢掉后一条短链接；最终修复整条跳过超长项，完整保留短链接，warning 仍有；普通短索引没有 warning。公开 writer→reader 控制证明正文外的 writer 提示不会挤掉两个完整长链接和十二个普通条目，并实际验证脚本可从证据仓库根目录运行。旧初稿和上一次 repaired build 的实际录像由不可变历史 commit 保留；正式依据是最后 rebase 后重新实录的 final-after、final-short-control、writer-control，source 51ae… / bundle 63b21…。mock usage 不是实际 token 数，不使用真实凭据或个人记忆，也不表示全仓测试全部通过。
