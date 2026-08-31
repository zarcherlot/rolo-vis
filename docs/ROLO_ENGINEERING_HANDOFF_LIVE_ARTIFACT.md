# rolo 工程移交：R1/R2 Live Gate 与 Artifact Analysis Producer

更新时间：2026-08-31

## 背景与当前状态

rolo 已在 `main@15e6b7d1` 合入：

- R1 Target Readiness：PR #47，feature `workbench.target-readiness/v1`；
- R2 Approval Gate：PR #48，feature `workbench.approval-gate-read-model/v1`。

rolo-vis consumer 已在 PR #23 合入，路线图在 PR #24 合入，P3 UX 收口在 PR #25 合入。
本地契约、parser、feature gate、只读 UI 和负向测试均已完成；当前唯一阻塞是没有可访问的
rolo runtime，无法执行真实控制面 live gate。Artifact Analysis 仍没有 rolo producer、feature
或 endpoint，前端仅保留 `demo_fixture`。

本文将这两项外部依赖转换为 rolo 工程开发项，供 rolo 团队直接领取。

## Workstream A：R1/R2 Runtime Harness 与 Live Gate

### A1. 提供可重复启动的只读 runtime

目标：让 consumer 可以在 CI/staging 中访问一个真实 HTTP control plane，而不是只运行 pytest
unit fixture。

建议落点：

- `tests/integration/` 或现有 rolo test harness；
- `docker-compose`/CI service container，或一个可配置端口的本地启动入口；
- 默认监听 loopback，端口通过环境变量传入，不改变生产安全策略。

必须提供：

- `GET /health`，并在 `api_features` 宣布 Job、R1、R2 feature；
- 已合入的 Job endpoints；
- `GET /v1/targets/readiness`；
- `GET /v1/targets/{target_id}/readiness`；
- `GET /v1/approval-gates`；
- `GET /v1/jobs/{job_id}/approval-gate`。

### A2. 准备确定性脱敏数据集

至少包含以下记录：

- 一个 `READY` local target；
- 一个 `HOST_KEY_REQUIRED` 或 `UNREACHABLE` SSH target；
- 一个 `WORKSPACE_MISSING` target；
- 一个 `APPROVAL_REQUIRED + PENDING + BLOCKED` gate；
- 一个 `APPROVED` 但 Gate 仍 `PENDING/FAILED` 的 gate，证明 approval 与 gate 独立；
- 一个 recovery `AVAILABLE` 和一个 `BLOCKED` 的 gate。

数据中不得出现真实 URI、用户名、private key、workspace path、known-hosts、token、命令行、
artifact bytes 或未脱敏 transport output。

### A3. 增加负向场景

runtime harness 必须能够通过 fixture 或测试注入覆盖：

- `producer_revision` 不一致；
- pagination `next_offset` 回退、越界或与请求不匹配；
- 重复 target/job identity；
- R2 重复 step action 或 gate check；
- `contains_secret_payloads: true`；
- raw path、`artifact://`、SSH URI、credential-bearing text；
- stale/unknown freshness；
- Job、target、gate 之间的 identity mismatch。

### A4. CI 验收命令与交付证据

rolo 团队交付后，rolo-vis 侧执行：

```text
ROLO_API_BASE=http://127.0.0.1:<port>/rolo-api npm run check:job-live
ROLO_API_BASE=http://127.0.0.1:<port>/rolo-api npm run check:r1-r2-live
```

rolo 侧应提供：

- harness 启动命令和固定端口/环境变量说明；
- 一次成功的 CI/staging run URL；
- 脱敏响应样例或 fixture revision；
- `/health.api_features` 输出；
- 负向场景测试结果。

验收标准：两条 live gate 均通过，且重复执行结果稳定；通过前不要把 R1/R2 producer 标记为
release-ready。

## Workstream B：Artifact Analysis Producer Contract

### B1. 发布公共 contract 与 feature

请在 rolo 中发布并写入 API 文档/schema registry：

- schema：`rolo-artifact-analysis-summary/v1`；
- feature：`workbench.artifact-analysis-read-model/v1`；
- 推荐只读 scope：`artifact-analysis:read`；
- 推荐 endpoint：`GET /v1/targets/{target_id}/artifact-analysis`；
- 若需要按 Job 查询，可增加 `GET /v1/jobs/{job_id}/artifact-analysis`，但必须保持同一 summary schema。

endpoint 只返回 bounded summary，不返回 artifact bytes。`source_kind` 对真实 producer 固定为
`rolo_api`，前端的 `demo_fixture` 不应被 producer 复用。

### B2. Summary 字段要求

至少覆盖当前 rolo-vis parser 已冻结的字段：

- `analysis_id`、`robot_id`、`run_id`、`discovery_id`；
- `source_kind`、`source_label`、`observed_at`、`freshness`；
- `gate_status` 与 gate/release 的中性展示字段；
- bounded metrics、operations、graph nodes、stages、findings、hashes；
- `limitations`；
- `contains_secret_payloads: false`。

producer 必须自行保证 analysis/job/target/discovery identity 关系，不能由浏览器拼装。
所有数组和文本必须有上限；hash 只能是脱敏 digest/短摘要，不能是文件路径或下载地址。

### B3. Artifact 安全边界

明确禁止：

- 文件系统路径、Windows 路径、SSH URI、用户名、private key、token；
- artifact bytes、base64、signed URL、download URL；
- shell command、argv、transport dump；
- 将分析完成推导为 capability readiness、Job success、physical outcome 或 release readiness。

当 artifact 不存在、过期、身份不一致或分析失败时，返回明确的 `stale`/`unknown`/`BLOCKED`/
`NOT_AVAILABLE` 和 limitation，不返回空对象或伪造 READY。

### B4. Producer 测试与交付物

rolo 侧至少增加：

- schema validation tests；
- happy path、partial、stale、identity mismatch、oversized、secret-bearing fixtures；
- feature negotiation test，确认 feature 只在 endpoint 可用时宣布；
- endpoint auth scope test；
- 不读取任意浏览器路径、不执行浏览器触发的命令的 regression test。

交付物：schema 文件、API 文档、producer implementation、测试 fixture、CI run、推荐 producer
minimum commit SHA。

## 完成后的 rolo-vis 侧动作

1. 使用 Workstream A 的 runtime 重跑 Job/R1/R2 live gate。
2. 记录 live gate 证据，将三个 consumer contract 从 `candidate` 提升为 `baseline`。
3. 根据 Workstream B 的最终 endpoint/字段，对齐 `src/roloClient.ts`、parser、UI 和 plugin manifest。
4. 新增 artifact live gate，移除 `demo-only` 限制，但继续保留 fail-closed 和只读边界。

## 不在本移交范围内

- 浏览器 approval、resume、retry、cancel、rollback 或 bootstrap execute；
- 任意文件浏览或 artifact 下载；
- 用 Agent/heuristic 推导 readiness 或 release 结论；
- 将 staging harness 当作物理设备验证证据。
