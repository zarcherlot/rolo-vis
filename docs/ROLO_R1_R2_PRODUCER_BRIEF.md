# rolo R1/R2 公共只读契约开发说明

面向：`rolo` 开发团队  
配套消费者：`rolo-vis`
当前消费者基线：`main@892c706`（PR #21 已合入）

本文用于把 R1 Target Readiness 与 R2 Approval/Gate/Recovery 从候选设计推进到
可发布的 rolo producer contract。rolo-vis 已准备好 fail-closed parser、feature
gate 和负向测试，但在 rolo 发布公共契约前不会激活新请求或 UI surface。

## 1. 共同发布闸门

R1、R2 都必须按以下顺序交付：

1. rolo producer 事实模型与 schema registry；
2. API endpoint、scope、分页、revision 和错误语义；
3. `/health.api_features` feature gate；
4. 正向、负向和脱敏 fixture；
5. paired rolo-vis live gate；
6. 真实控制面证据和 release notes；
7. rolo-vis 才能把 contract 从 blocked/candidate 提升为 baseline。

禁止先在前端用现有 Overview、Pipeline、bootstrap-plan 或 stage authorization
拼出 R1/R2 结果。Producer 必须拥有事实、时间戳、revision、权限边界和限制说明。

## 2. R1：Target Readiness / Connection Assessment

### 2.1 公共标识

- schema：`rolo-target-readiness-summary/v1`
- feature：`workbench.target-readiness/v1`
- 建议只读 scope：`targets:read`（不要复用写侧 bootstrap scope）
- 建议 endpoint：
  - `GET /v1/targets/readiness?limit={n}&offset={n}`
  - `GET /v1/targets/{target_id}/readiness`
- 最终路径、scope 和 query 语义由 rolo 正式文档定稿；消费者不会猜测替代路径。

### 2.2 最小字段与语义

```text
schema_version: "rolo-target-readiness-summary/v1"
target_id: opaque stable ID
target_kind: "local" | "ssh"
state: "READY" | "HOST_KEY_REQUIRED" | "UNREACHABLE" |
       "WORKSPACE_MISSING" | "UNSUPPORTED"
reachable: boolean
host_key_pinned: boolean
platform: bounded display string
architecture: bounded display string
workspace_accessible: boolean
companion: "NOT_REQUIRED" | "AVAILABLE" | "MISSING" | "UNKNOWN"
blockers: bounded string[]
diagnostics: bounded string[]
limitations: bounded string[]
observed_at: RFC3339 timestamp
freshness: "fresh" | "stale" | "unknown"
producer_revision: opaque revision
contains_secret_payloads: false
```

`READY` 只表示 producer-owned connection/readiness 事实，不代表 Job 成功、
Operation 可执行、物理结果成立或 release readiness 成立。`UNREACHABLE`、
`HOST_KEY_REQUIRED`、`WORKSPACE_MISSING` 和 `UNSUPPORTED` 必须分别保留原因，不能
折叠成一个泛化的 `NOT_READY`。

### 2.3 事实来源与状态一致性

- local/ssh target identity 必须来自 rolo target profile，不得从 URL 或 UI 字符串推导；
- Verify readiness 可以提供事实输入，但 bootstrap-plan 只能作为计划/限制信息，不能直接变成 READY；
- host-key rotation 后必须回到 `HOST_KEY_REQUIRED` 或明确的阻塞状态；
- workspace 缺失、平台不支持、网络不可达需要稳定且可审计的 blocker code/文本；
- `observed_at`、`freshness`、`producer_revision` 必须属于同一份 read model；
- stale 数据要保留原状态和限制，不得刷新时间戳伪装成 fresh。

### 2.4 边界与拒绝规则

公共 payload 不得出现：

- SSH URI、用户名、私钥、known-hosts、token 或 credential；
- workspace/raw path、设备路径、命令参数、shell 文本或 transport dump；
- 可直接调用 bootstrap/execute 的 payload、signed URL 或 artifact bytes；
- 无界文本、无界集合或未声明 schema 的额外字段。

建议所有 bounded string 设置明确上限（例如 240 字符），集合设置最大数量，
并在 producer 单元/API 测试中验证超限拒绝。`contains_secret_payloads` 必须显式
为 `false`，缺失或为 `true` 均拒绝。

### 2.5 分页与错误语义

- 列表使用有界 `limit/offset`，`1 <= limit <= 100`；
- `items` 不重复，`next_offset` 必须单调递增并受 `total` 约束；
- 详情不存在返回稳定的 404 code；
- query 非法返回 422；
- target identity/revision 与请求不一致返回 409；
- producer 不可提供安全摘要时返回明确的 503/可诊断错误，不返回半成品或未经标注的 demo 数据。

## 3. R2：Approval / Gate / Recovery Read Model

### 3.1 公共标识

- schema：`rolo-approval-gate-summary/v1`
- feature：`workbench.approval-gate-read-model/v1`
- 建议只读 scope：`approval-gates:read`
- 建议 endpoint：
  - `GET /v1/approval-gates?limit={n}&offset={n}`
  - `GET /v1/jobs/{job_id}/approval-gate`
- R2 应在 R1 与 E24 Job revision 语义稳定后独立发布，不与 R1 混成一个 PR。

### 3.2 四个独立维度

```text
schema_version: "rolo-approval-gate-summary/v1"
job_id: opaque stable ID
target_id: opaque stable ID
producer_revision: opaque revision
plan_status: "READY" | "APPROVAL_REQUIRED" | "BLOCKED"
steps[]:
  action: bounded label
  risk: bounded label
  approval_required: boolean
  description: bounded display text
required_approvals[]: bounded approval descriptors
approval_status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | null
gate_status: "PENDING" | "PASSED" | "FAILED" | "BLOCKED"
gate_checks[]: bounded check summaries
recovery_state: "NOT_REQUIRED" | "AVAILABLE" | "BLOCKED" | "UNKNOWN"
blockers: bounded string[]
limitations: bounded string[]
observed_at: RFC3339 timestamp
freshness: "fresh" | "stale" | "unknown"
contains_secret_payloads: false
```

`plan_status`、`approval_status`、`gate_status` 和 `recovery_state` 必须分别由
producer 维护。不能返回一个合并的“可执行”布尔值，也不能把 `APPROVED` 或
`PASSED` 解读为 Job 成功、物理结果成立或 release readiness 成立。

### 3.3 Job/Target/revision 绑定

- Job detail 与 Approval/Gate detail 的 `job_id` 必须完全一致；
- `target_id` 必须与该 Job 的 producer-owned target identity 一致；
- 所有状态和 `observed_at` 必须绑定同一 `producer_revision`；
- revision 漂移、job/target 不匹配、事件或 gate 检查序列回退都必须 fail closed；
- 空 `steps`、重复 approval、重复 gate check identity、未知状态必须拒绝。

### 3.4 Recovery 只读边界

`recovery_state` 只能是状态摘要。公共 payload 不得包含或暗示以下可调用参数：

- resume/retry/cancel/rollback endpoint、HTTP method 或 request body；
- command argv、shell 文本、workspace/raw path、token、signed URL；
- 可被浏览器直接重放的 approval token 或 transport output。

所有恢复和审批动作继续留在 rolo/CLI 的既有授权链路。rolo-vis 只允许展示状态、
限制和上下文跳转，不新增按钮、写 endpoint 或自动恢复逻辑。

## 4. 测试与 fixture 交付矩阵

### R1 必须提供

- local READY；
- ssh READY；
- HOST_KEY_REQUIRED 与 host-key rotation；
- UNREACHABLE；
- WORKSPACE_MISSING；
- UNSUPPORTED；
- stale/partial 数据；
- 越界文本、raw path、credential、URI、命令参数拒绝；
- 分页重叠/重复、详情 404、query 422、revision/identity 409。

### R2 必须提供

- approval pending/approved/rejected/expired；
- gate pending/passed/failed/blocked；
- recovery not-required/available/blocked/unknown；
- job/target mismatch、revision drift、空 step、重复 identity；
- secret-bearing payload、raw path、command args、未脱敏 transport output 拒绝；
- 列表与详情分页一致性、稳定 404/409/422 语义。

每个 fixture 只包含 opaque IDs、bounded display text、时间戳、revision 和脱敏
诊断摘要。不要把真实 SSH 配置、凭据、设备路径或 artifact bytes 放入仓库。

## 5. rolo-vis 接入验收

rolo 发布后，请提供以下信息给消费者：

1. schema registry URL/版本和 API 文档；
2. `/health.api_features` 样例；
3. scope、分页、revision、404/409/422 语义；
4. 脱敏 positive/negative fixture 及其 producer revision；
5. paired 控制面地址和运行说明。

rolo-vis 将执行：

- feature 缺失时零新增请求、零新增导航项；
- parser 正向/负向测试和安全字段扫描；
- 跨 target/job 切换、stale/partial、分页单调性和 revision drift live gate；
- 验证刷新/重连不会触发审批、恢复、执行或写请求；
- 通过后再更新 compatibility manifest、roadmap 和 baseline 版本。

## 6. 建议的 rolo PR 拆分

### R1 PR：Target Readiness

- 分支建议：`codex/r1-target-readiness-contract`；
- 内容：schema registry、producer model、两个只读 endpoint、feature gate、scope、
  API 文档、正负 fixture、API 测试、release notes；
- 不包含 Approval/Gate/Recovery，不调用 bootstrap-execute。

### R2 PR：Approval/Gate/Recovery

- 分支建议：`codex/r2-approval-gate-read-model`；
- 内容：独立四维 read model、列表/Job 详情 endpoint、feature gate、scope、
  revision/identity 绑定、正负 fixture、API 测试、release notes；
- 不包含 resume/retry/cancel/rollback/release 写入口。

每个 PR 合入前保持 feature gate 默认关闭或仅在明确的 staging profile 宣布；
合入后不要删除可追溯的 producer 分支，直到 paired live gate 和 release evidence
完成。

## 7. 不通过条件

出现以下任一情况时，rolo-vis 会保持 R1/R2 blocked，不会用 demo 或旧接口替代：

- feature 在 `/health` 未宣布，或宣布与 endpoint 不一致；
- schema、scope、分页、revision 或错误语义未写入正式文档；
- payload 包含凭据、raw path、命令、transport dump 或 artifact bytes；
- approval/gate/recovery 被合并成执行结论；
- fixture 无法证明 job/target/revision 绑定或 fail-closed 行为；
- 只有“看起来 READY/PASSED”的样例，没有不可达、过期、漂移和拒绝样例。
