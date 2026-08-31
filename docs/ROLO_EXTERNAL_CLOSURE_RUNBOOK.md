# rolo 外部收口运行手册

更新时间：2026-08-31

这份手册是 rolo 团队提交 R0/R3 外部证据、由 rolo-vis 验收并推动 baseline
promotion 的唯一入口。它不授予浏览器任何执行、恢复、回滚或凭据处理权限。

## 当前状态

- rolo-vis 本地 `verify:baseline`、paired read-model gate 和安全负向测试已通过。
- rolo 远端没有未关闭的 PR 或 issue；最新 `main` 为 `ec8f635656806776c2dc8ced04a2e6c057980410`（PR #52）。
- 当前环境没有 staging endpoint、token 或真实设备证据，因此 R0 live gate 与 R3
  真实设备收口仍保持 `PENDING_EXTERNAL`，不会用 fixture 冒充真实证据。

## rolo 团队交付

请通过受控 staging/CLI 路径运行测试，并交付一个脱敏 JSON bundle。不得把 token、私钥、
SSH URI、known-hosts、workspace/raw path、命令参数、transport dump 或 artifact bytes
写入 bundle、PR 或 issue。

必填顶层字段：

```json
{
  "schema_version": "rolo-vis-device-hardening-evidence/v1",
  "release_line": "v0.37.x",
  "rolo_revision": "<7-64 hex commit>",
  "producer_revision": "<7-64 hex commit>",
  "target_id": "<opaque target id>",
  "target_kind": "local|ssh",
  "evidence": []
}
```

每个 evidence item 必须包含 `scenario_id`、`status`（`VERIFIED`、`BLOCKED` 或
`PENDING_EXTERNAL`）。rolo producer 对未执行项允许显式输出 `"evidence": null`；
rolo-vis 会将其视为缺省证据。只有 `VERIFIED` 必须附带 `os`、`architecture`、签名包
`package_digest`、opaque `job_id`、`gate_result`、ISO 时间戳 `observed_at` 和脱敏
`summary`。一个 target 的 scenario 不得重复。

## 验收矩阵

至少提交以下十个 external scenario；失败或未执行的项保留 `BLOCKED`/
`PENDING_EXTERNAL`，不得汇总为 READY：

`linux-arm64`、`linux-x86_64`、`offline-install`、`non-root-sudo`、`ssh-jump-host`、
`host-key-rotation`、`network-interruption`、`restart-resume`、`upgrade-rollback`、
`enrollment-rotation`。

每项人工 review 时记录 OS/架构、包 digest、Job ID、Gate 结果、观察时间、限制和失败原因。

## rolo-vis 验证命令

在临时 shell 中注入凭据（不要写入仓库）：

```powershell
$env:ROLO_BASE_URL = "https://<staging-control-plane>"
$env:ROLO_API_BASE = $env:ROLO_BASE_URL
$env:ROLO_API_TOKEN = "<short-lived-token>"
npm run check:job-live
npm run check:r1-r2-live
npm run check:artifact-analysis-live
```

当前 live gate 已支持从 `ROLO_API_TOKEN` 注入 `Authorization: Bearer` header；未设置或
过期 token 时应明确返回 401/403，不能回退到 fixture。浏览器端不读取此环境变量。

收到 bundle 后先做本地 fail-closed 校验：

```powershell
$env:ROLO_DEVICE_EVIDENCE_BUNDLE = "C:\\secure\\handoff\\device-hardening-evidence.json"
npm run check:device-hardening-evidence
```

仓库中的 `tests/fixtures/device-hardening-evidence.pending.json` 仅用于验证校验器，
其中十个场景全部是 `PENDING_EXTERNAL`，绝不可作为真实设备证据或 release 依据。

校验通过后，将证据映射到 `tests/fixtures/device-hardening-matrix.json`，逐项人工复核，
再运行 `npm run verify:baseline`。任一 live gate、证据或 redaction 失败，都不得提升
matrix 状态或合入 baseline。

## 收口产物

rolo 团队提交：bundle、staging harness 版本、rolo release/producer revision、失败与限制
说明。rolo-vis 团队提交：校验输出、paired/live gate 日志摘要、更新后的矩阵和 release
ledger。证据只保留可审计摘要，原始日志留在受控 staging 系统。
