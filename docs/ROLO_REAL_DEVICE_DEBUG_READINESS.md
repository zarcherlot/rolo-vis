# rolo 真机调试前剩余开发项

更新时间：2026-08-31  
适用版本：rolo `main@ec8f6356`、rolo-vis `main@9cd6e7a`（RV-01 实现在审查分支）

这份清单只列“第一次连接真实机器人前”仍需完成的工作。确定性 harness 已通过，
不再把 harness 结果当作真机证据。

## 当前已完成

- rolo R0 Job、R1 Target Readiness、R2 Approval/Gate、R4 Artifact Analysis producer
  已合入 `main`。
- rolo-vis 对应 parser、feature gate、只读 UI、负向测试和 live gate 已合入 `main`。
- paired rolo harness 已验证：Job、R1/R2、Artifact Analysis 全部通过；rolo staging
  bootstrap harness 和 producer/API 定向测试通过。
- rolo-vis 已能校验 rolo `export-device-hardening` 生成的 v1 bundle，包括 producer
  对未执行项显式输出 `evidence: null` 的情况。

## P0：真机前必须完成的工程项

### RD-01 认证传输路径（rolo-vis + rolo 联调）

当前 live gate 和 `RoloClient` 的 fetch 不携带 `Authorization: Bearer ...`；loopback
harness 不需要认证，所以该问题尚未被 paired gate 暴露。rolo 远端绑定或配置
`ROLO_API_TOKEN` 时，非 `/health` 请求会强制认证和 scope 校验。

需要完成：

- 确定 staging 采用同源 HttpOnly session/reverse proxy，还是 live gate 使用短时 bearer
  token；两者只能由 rolo 服务端负责签发和校验。
- 若采用 bearer gate，为 `RoloClient` 和三个 live gate 增加统一的内存态 header 注入，
  并测试 401/403、scope 缺失、token 过期；token 不进入 URL、localStorage、日志或 bundle。
- 若采用同源 session，验证 `/v1/session`、cookie、HTTPS、CSRF/同源策略和 API 路径
  重写，确认浏览器不需要读取 token。

完成定义：带认证的 staging endpoint 上，Job/R1/R2/R4 四组 gate 均能通过；错误认证
只产生明确失败，不回退 fixture 或 demo 数据。

### RD-02 不可变部署身份与供应链

需要在部署前固定并记录：rolo 40 位 revision、rolo-vis revision、插件包 digest、
target profile、target machine identity、workspace identity、OS/architecture、
ROS domain/RMW，以及 SSH host-key/approved deployment。

完成定义：任一 revision、target、workspace、host-key 或 package digest 漂移都在真机
操作前被拒绝；报告中的 revision 与目标机实际 revision 完全一致。

### RD-03 只读真机 preflight

第一次连接只允许做以下读取：`/health`/feature negotiation、target readiness、Job
列表/详情/事件、approval/gate/recovery 摘要、artifact-analysis 摘要和设备信息采集。

完成定义：预检报告包含 target/Job opaque ID、feature、schema、scope、时间戳和限制；
不调用 `bootstrap-execute`、resume/retry/cancel/rollback/release，不读取任意路径或
artifact bytes。

### RD-04 设备证据与 release ledger

rolo 通过 `rolo target export-device-hardening` 生成 bundle 和 ledger；真实设备执行
后再补齐十个 external scenario。rolo-vis 校验 bundle 后，人工复核失败/限制，保持
`PENDING_EXTERNAL`/`BLOCKED`，不得自动升格 READY。

完成定义：证据可追溯到 rolo release、target、producer revision、Job ID 和 package
digest；公开材料无凭据、路径、transport dump 或 artifact bytes。

### RD-05 真机安全观察与回退责任

需要在第一次连接前明确安全观察者、急停/回退责任人、允许的只读 operation、网络中断
和进程退出处理方式。rolo-vis 不承担执行或回退权限。

完成定义：测试窗口、目标、操作白名单、停止条件和事故记录位置已写入 staging 记录；
任何不确定状态都停止并保留 `BLOCKED`。

## P1：首轮真机调试后补齐

- 真实网络中断、rolo 重启、Job recovery、host-key rotation、升级/回滚和 enrollment
  rotation 证据。
- 3–5 个只读/native shadow 窗口，记录相同 revision/profile 下的稳定性、超时和
  silent-drop；不将 shadow 结果解释为 release readiness。
- real-data UI 回归：fresh/stale/unknown/404/409、跨 target/job 切换、键盘焦点、
  窄屏和 reduced-motion。
- 将真实 live gate 与人工 review 结果写入 release ledger，再单独评审 candidate →
  baseline promotion。

## 不属于真机前阻塞项

- R1/R2/R4 producer contract：已由 rolo 发布并通过 paired gate。
- rolo-vis parser、negative tests、read-only UI：已合入并通过 `verify:baseline`。
- Episode 媒体、回放、导出、重采集及任何浏览器写侧能力：不在本轮真机只读调试范围，
  不应为此阻塞连接。

## 推荐执行顺序

1. rolo 与 rolo-vis 先定稿并实现 RD-01 认证路径。
2. 固定 RD-02 revision/package/target 身份并生成部署记录。
3. 执行 RD-03 只读 preflight；失败立即停止。
4. 在安全观察责任明确后进行第一轮真机只读调试。
5. 采集 RD-04 证据并完成 RD-05 的中断/回退演练，再进入 P1 项。

详细 bundle 字段和脱敏规则见 [`ROLO_EXTERNAL_CLOSURE_RUNBOOK.md`](./ROLO_EXTERNAL_CLOSURE_RUNBOOK.md)。

## 按仓库拆分的开发计划

### A. rolo-vis 开发项

| ID | 优先级 | 开发项 | 交付物 | 依赖 |
|---|---|---|---|---|
| RV-01 | P0 | 认证传输适配 | `RoloClient` 与 Job/R1/R2/R4 gate 的统一 auth transport；401/403、scope 缺失、过期测试；token 不落 URL/storage/log | rolo 确认 bearer 或同源 session 方案 |
| RV-02 | P0 | 真机只读 preflight | 一条 bounded preflight 命令，固定顺序检查 health、feature、readiness、Job、Gate、Artifact Analysis，并输出脱敏报告 | RV-01、rolo staging endpoint |
| RV-03 | P0 | 设备证据导入与矩阵映射 | 将 rolo bundle/ledger 映射到 `device-hardening-matrix`，保留 `PENDING_EXTERNAL`/`BLOCKED`，禁止自动 READY | rolo `export-device-hardening` 产物 |
| RV-04 | P1 | 真实数据 UI 回归 | fresh/stale/unknown/404/409、跨 target/job、重连、键盘焦点、窄屏和 reduced-motion 验收记录 | RV-02、真实 staging 数据 |
| RV-05 | P1 | 部署包与 revision 复核 | 校验 rolo-vis commit、插件包 digest、构建产物和目标安装版本一致 | rolo 部署记录 |
| RV-06 | P2 | baseline promotion 记录 | 在所有 live gate、证据 review 和安全门禁通过后，更新 candidate → baseline 的版本/证据记录 | RV-03～RV-05 |

当前 rolo-vis 已完成：parser、feature gate、read-only UI、deterministic live gates、
证据 bundle validator 和基础构建验证。RV-01 的 bearer transport 已在审查分支实现，
并在启用 rolo token/scopes 的 harness 上验证通过；浏览器端仍只使用 same-origin
credentials。RV-02～RV-03 是首次真机前仍可能需要代码变更的项目；RV-04～RV-06 应在
首轮数据可用后执行。

### B. rolo 开发项

| ID | 优先级 | 开发项 | 交付物 | 真机前验收 |
|---|---|---|---|---|
| RL-01 | P0 | staging runtime 与认证配置 | 固定 revision 的 HTTP control plane、HTTPS/同源策略、短时 read-only token 或 session 方案、scope 配置 | `/health` 可访问；非 health 请求的 401/403/scope 行为稳定 |
| RL-02 | P0 | target identity 与 approved deployment | target profile、machine-id、workspace、OS/arch、ROS domain/RMW、SSH host-key、部署包 digest 的绑定记录 | 任一身份/签名/revision 漂移在执行前拒绝 |
| RL-03 | P0 | real-target readiness/preflight producer | 对 local/SSH target 生成 reachability、host-key、workspace、platform、companion 和 blocker 事实 | 不可达、host-key 缺失、workspace 缺失和 unsupported 均给出稳定状态 |
| RL-04 | P0 | 真机安全执行边界 | 明确只读 operation 白名单、safe-stop、急停/回退责任和授权链；浏览器不获得写权限 | 首轮调试可在不调用 bootstrap/resume/rollback 的情况下完成 |
| RL-05 | P0 | device evidence producer 实接 | 通过 `rolo target export-device-hardening` 接入真实 audited input，输出 bundle 与 release ledger | 十个 external scenario 可逐项追溯；未执行项仍 pending/block |
| RL-06 | P1 | 中断与生命周期验证 | network interruption、rolo restart、Job recovery、host-key rotation、upgrade/rollback、enrollment rotation 演练 | 终态只能为明确失败/取消/阻断，不自动恢复旧执行 |
| RL-07 | P1 | staging harness 与真实目标分层 | 保留 deterministic harness 作为协议回归，另建真实目标 profile/报告入口 | harness PASS 不会被标记为 physical/release readiness |
| RL-08 | P2 | native shadow/canary 观察 | 固定 profile/revision 的 3–5 个 shadow 窗口与后续 canary 记录 | 零 silent drop、高严重度 parity diff；不授予 release authority |

rolo R1/R2/R4 producer、device-hardening schema/export 和 deterministic harness 已完成；
RL-01～RL-05 是 rolo 团队在首次真机前的主要工程/发布工作，RL-06～RL-08 属于首轮调试后
的验证和放量工作。

### C. 只需运行时提供的项目

这些不是新增代码项，但没有它们不能开始真机调试：

- staging control-plane 地址和网络白名单；
- 短时、最小 scope 的认证凭据（通过受控渠道提供，不提交 Git）；
- 已批准的真实 target profile、SSH host-key 和 deployment revision；
- 安全观察者、急停/回退责任人、调试窗口和停止条件；
- 真机执行后的脱敏 bundle、release ledger、live gate 输出和人工 review 结论。

## 依赖关系与收口顺序

```text
rolo RL-01/RL-02
        ↓
rolo-vis RV-01
        ↓
rolo RL-03/RL-04
        ↓
rolo-vis RV-02/RV-03 + rolo RL-05
        ↓
首次真机只读 preflight / 调试
        ↓
RL-06/RL-08 + RV-04/RV-05
        ↓
RV-06 candidate → baseline review
```

在 RV-01 和 RL-01 未完成前，不应使用远端 staging 的“无认证假设”判断 rolo-vis
可用；在 RL-02～RL-04 未完成前，不应把任何真实 target 连接视为可安全执行；在
RV-03/RL-05 未完成前，不应把真机结果写成 baseline。
