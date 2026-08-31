# rolo 上游发布开发计划

更新时间：2026-08-31  
目标仓库：`rolo`  
配套消费者：`rolo-vis`

## 1. 目标与当前基线

本计划用于指导 rolo 发布后续公共只读 read-model，使 rolo-vis 能够在不增加浏览器写权限的前提下，逐步激活 Job、Target Readiness、Approval/Gate/Recovery、设备加固证据和真实 artifact 分析能力。

当前已知基线：

- rolo `origin/main`：`780d7a5`。
- E24 Job producer 已由 PR #38 合入。
- E23 Workbench plugin host 已由 PR #39 合入。
- Adapt evidence slice hardening 已由 PR #42 合入。
- 文档刷新已由 PR #40/#43 合入。
- rolo 已提供并宣布 `workbench.job-read-model/v1`，包括 `/v1/jobs`、`/v1/jobs/{job_id}`、`/v1/jobs/{job_id}/events`。
- rolo-vis consumer PR #19 和 Job hardening PR #20 已合入；真实控制面 live gate 仍待执行。
- rolo 当前尚未发布 `workbench.target-readiness/v1` 或 `workbench.approval-gate-read-model/v1`。

## 2. 不可突破的发布原则

1. 所有新能力必须由 rolo producer 拥有事实、状态、时间戳、版本和权限边界；rolo-vis 只展示已发布 read model。
2. 新能力必须通过 `/health.api_features` feature gate 协商；feature 缺失时客户端不得请求、不得显示、不得回退到 demo 数据。
3. 公共 payload 只允许 opaque `target_id`、`job_id`、`event_id`、`checkpoint_id` 等稳定身份，不得包含 SSH URI、用户名、私钥、known-hosts、workspace/raw path、命令参数、token、未脱敏 transport output 或 artifact bytes。
4. Approval、Gate、Recovery、物理结果和 release readiness 必须保持独立；任何单一状态不得被解释为执行成功或发布许可。
5. 浏览器不得获得 `bootstrap-execute`、resume、retry、cancel、rollback、release 等写权限；所有写动作继续留在 rolo/CLI 和既有授权链路。
6. 每个阶段遵循：公共 contract → 客户端 parser → feature gate → paired live gate → 真实证据 → baseline promotion。

## 3. 发布阶段与交付物

### R0：E24 Job read-model 发布收口

状态：producer 与 rolo-vis consumer/hardening 均已合入；等待真实 live gate 和 baseline promotion。

rolo 需要确认并固化：

- `workbench.job-read-model/v1` feature 在 `/health` 稳定宣布。
- 三个 Job endpoint 的 schema、分页、排序、revision 和错误语义写入正式 contract 文档。
- `GET /v1/jobs` 支持有界 `limit/offset`，不返回任意文件路径或原始执行输出。
- `GET /v1/jobs/{job_id}` 返回 Job、latest event、latest checkpoint 和 resumable 状态；不存在的 Job 返回稳定 404 code。
- `GET /v1/jobs/{job_id}/events` 保证 `job_id` 绑定、稳定 sequence、时间戳和有界分页。
- `jobs:read` scope 与 endpoint 绑定，写侧 scope 不得隐式继承。
- 增加跨页重复、revision 漂移、事件归属错误、敏感字段泄漏和过大 payload 的负向测试。

完成闸门：

- rolo 单元/API 测试通过。
- rolo-vis `npm run check:job-live` 在 paired rolo 和至少一份脱敏真实样本上通过。
- rolo-vis consumer PR 合入后，再将 Job contract 从 candidate 提升为 baseline。

### R1：E24C Target Readiness / Connection Assessment

状态：尚未发布；当前 rolo-vis 只保留 parser 和 blocked contract。

#### 必须发布的公共 contract

- schema：`rolo-target-readiness-summary/v1`
- feature：`workbench.target-readiness/v1`
- 建议资源形态：
  - `GET /v1/targets/readiness?limit={n}&offset={n}`
  - `GET /v1/targets/{target_id}/readiness`
- 最终路径、分页方式和 scope 需在 rolo PR 中定稿，不能由前端自行假设。

#### 最小字段集合

- `target_id`
- `target_kind`: `local | ssh`
- `state`: `READY | HOST_KEY_REQUIRED | UNREACHABLE | WORKSPACE_MISSING | UNSUPPORTED`
- `reachable`
- `host_key_pinned`
- `platform`
- `architecture`
- `workspace_accessible`
- `companion`: `NOT_REQUIRED | AVAILABLE | MISSING | UNKNOWN`
- `blockers[]`、`diagnostics[]`、`limitations[]`
- `contains_secret_payloads: false`

#### Producer 任务

- 从现有 target profile、Verify readiness 和 bootstrap-plan 读模型中提取事实，但不把执行计划当作 readiness 结果。
- 对 SSH host-key 缺失、网络不可达、workspace 缺失、平台不支持分别产出稳定状态和限制说明。
- 所有文本和集合设置长度上限，拒绝 raw path、credential、URI、命令参数和 transport dump。
- 提供列表与详情的 404/409/422 语义，以及旧客户端兼容策略。
- 将 `target-readiness-summary/v1` 写入 schema registry、API 文档和版本兼容矩阵。

#### 验证闸门

- local、ssh、host-key rotation、unreachable、workspace missing、unsupported 至少各一份脱敏 fixture。
- rolo API 测试覆盖 secrets/raw path 拒绝、状态与事实不一致拒绝、分页单调推进。
- paired rolo-vis live gate 覆盖 feature 缺失时零请求、部分状态保留限制文本、跨机器人切换和 stale 数据。

### R2：E25 Approval / Gate / Recovery read-model

状态：尚未发布；当前 rolo-vis 只保留 parser 和 blocked contract。

#### 必须发布的公共 contract

- schema：`rolo-approval-gate-summary/v1`
- feature：`workbench.approval-gate-read-model/v1`
- 建议资源形态：
  - `GET /v1/approval-gates?limit={n}&offset={n}`
  - `GET /v1/jobs/{job_id}/approval-gate`
- 最终路径、scope、分页和历史 revision 语义需在 rolo PR 中定稿。

#### 最小字段集合

- `job_id`、`target_id`
- `plan_status`: `READY | APPROVAL_REQUIRED | BLOCKED`
- `steps[]`: `action`、`risk`、`approval_required`、bounded `description`
- `required_approvals[]`
- `approval_status`: `PENDING | APPROVED | REJECTED | EXPIRED | null`
- `gate_status`: `PENDING | PASSED | FAILED | BLOCKED`
- `gate_checks[]`
- `recovery_state`: `NOT_REQUIRED | AVAILABLE | BLOCKED | UNKNOWN`
- `blockers[]`、`limitations[]`
- `contains_secret_payloads: false`

#### Producer 任务

- 将 plan、approval、Gate、recovery 建模为四个独立维度，不返回一个合并的“可执行”布尔值。
- 将每个状态绑定到 opaque `job_id`/`target_id` 和 producer revision。
- 将 recovery 设计为状态摘要，不返回 resume/retry/cancel/rollback 的可调用 payload。
- 明确 approval 已批准不代表 Job 成功、物理结果成立或 release readiness 成立。
- 将所有写 endpoint 与 read-model scope 分离，拒绝浏览器 token 复用写权限。

#### 验证闸门

- 覆盖 approval pending/approved/rejected/expired、gate passed/failed/blocked、recovery available/blocked/unknown。
- 覆盖 job/target 不匹配、状态与 revision 漂移、空 step、敏感字段和 raw path 泄漏。
- rolo-vis live gate 必须证明刷新/重连不会自动恢复执行，也不会出现审批或恢复按钮。

### R3：E26 设备侧加固证据发布

状态：消费者已有证据矩阵，真实设备证据仍为 `PENDING_EXTERNAL`。

rolo 需要提供：

- 固定版本的 staging harness 和脱敏 evidence bundle schema。
- 至少覆盖 Linux ARM64/x86_64、离线安装、非 root/sudo、SSH jump host、host-key rotation、网络中断、重启恢复、升级/回滚、enrollment rotation。
- 每个场景只发布 OS/架构、签名包 digest、Job ID、Gate 结果、诊断摘要和时间戳。
- 缺失或失败场景保持 `PENDING_EXTERNAL` / `BLOCKED`，不得由汇总层推导成 READY。
- 证据 bundle 必须可追溯到 rolo release、target identity 和 producer revision，且不包含凭据、raw path 或 artifact bytes。

完成闸门：

- staging 全矩阵可重复执行。
- 至少一轮真实设备证据经过人工 review。
- 失败场景和已知限制进入 release ledger，而不是隐藏在日志中。

### R4：真实设备 artifact analysis read-model

状态：rolo-vis 已完成明确标注 demo fixture 的 versioned/sanitized parser；rolo producer endpoint 尚未发布。

rolo 需要提供：

- versioned、sanitized、可校验的 artifact analysis read model。
- 关联 `job_id`、`target_id`、`discovery_id`、evidence IDs、source provenance 和 freshness。
- `PARTIAL`、`STALE`、`INCOMPATIBLE`、`BLOCKED` 等状态，不把分析完成升级为物理结果或 release 验证。
- bundle digest/identity/schema mismatch 的稳定错误语义。
- API 优先、无 API 时明确 demo；禁止 silent fallback 和任意路径读取。

## 4. rolo PR 与分支顺序

1. R0 之后先合入 rolo-vis E24 consumer PR，并执行 paired/real Job live gate。
2. R1 以独立 rolo feature branch 发布 Target Readiness contract；不要与 E25 混合合入。
3. R2 在 R1 稳定后独立发布 Approval/Gate/Recovery read-model。
4. R3 通过 staging harness 和人工证据 review 后再进入 baseline promotion。
5. R4 最后接入 artifact analysis，保持与 Job、Target、Evidence 的 opaque ID 关系。
6. 每个 PR 必须包含 schema、API 文档、feature gate、scope、正向测试、负向安全测试和脱敏 live evidence。
7. PR 合入后再清理源分支；未合入前不得删除可追溯分支。

## 5. 统一 Definition of Done

- `/health.api_features` 与实际 endpoint 一致。
- schema registry、API 文档、兼容矩阵和 release notes 同步。
- 默认旧 rolo-vis 不发新请求；feature 缺失时完全隐藏新 surface。
- API、scope、分页、revision、错误码和 redaction 均有自动化测试。
- paired rolo-vis live gate 通过；涉及设备或 artifact 的阶段还必须有脱敏真实证据。
- 未通过真实 gate 的能力保持 candidate / blocked，不提升为 baseline。
- 浏览器没有新增执行、审批、恢复、回滚、任意文件访问或凭据处理权限。

## 6. 当前行动项

### rolo 团队

- [ ] 维护并发布 R0 Job contract 的正式 schema/文档版本。
- [ ] 评审并确定 R1 Target Readiness endpoint、scope 和分页语义。
- [ ] 评审并确定 R2 Approval/Gate/Recovery endpoint、scope 和 revision 语义。
- [ ] 提供 R3 staging harness 和脱敏设备证据入口。
- [ ] 设计 R4 artifact analysis producer contract。

### rolo-vis 团队

- [x] 合入 `codex/e24-job-read-model-consumer`（PR #19）并完成 Job contract hardening（PR #20）。
- [ ] 连接真实 rolo 控制面，运行 `npm run check:job-live`。
- [ ] 在 R1/R2 feature 发布前保持 parser、negative tests 和 UI surface blocked。
- [x] 为 R4 建立 artifact analysis parser、demo-only contract 和负向安全测试；等待 rolo producer contract。
- [ ] 每个 upstream contract 发布后建立 paired live gate，并更新 baseline/roadmap。
