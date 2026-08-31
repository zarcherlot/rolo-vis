# rolo-vis 后续开发计划

更新时间：2026-08-31

## 当前基线

- `origin/main` 已包含 E24/E24C hardening；rolo 上游 R1 PR #47、R2 PR #48 已合入，最新 producer main 为 `15e6b7d1`。
- rolo 远端状态已通过 GitHub API 核对；本地 rolo checkout 不作为本轮修改目标。
- rolo `origin/main` 已提供并宣布 Job、R1 Target Readiness（`workbench.target-readiness/v1`）和 R2 Approval Gate（`workbench.approval-gate-read-model/v1`）feature，分别暴露分页列表与详情 GET 接口；旧 E23/E24 远端分支引用已自动清理。
- `npm run verify:baseline` 已通过：234 个应用测试、TypeScript、生产构建、Sites 打包测试全部通过。
- 当前版本为 `0.37.0`，已冻结 Episode Observation Bundle（E22）只读基线。

## 本轮推进（2026-08-31）

- 补齐 `rolo.plugin.json` 的 Job、R1、R2 只读能力声明和对应 endpoint 白名单。
- Job Inbox 增加事件分页、独立加载状态和跨页 event/job ID 去重；feature 缺失时仍完全隐藏且不发请求。
- rolo-vis R1/R2 consumer 已由 PR #23 合入 `main`，merge commit 为 `3d5343e3`；新增 Readiness、Approval Gates 两个 feature-gated 只读 surface。
- 已补充 `scripts/check-job-read-model.mjs`、`scripts/check-r1-r2-live.mjs` 及对应 npm 命令：只读检查 feature 协商、分页、身份绑定、一致性及敏感字段；真实控制面 live gate 仍待执行。
- 已完成 P3 分包优化：React、Flow、图标和 artifact 数据独立成 chunk，主 JS 约 381 kB；完整 `npm run verify:baseline` 通过（225 tests、typecheck、build、Sites 4 tests）。
- paired rolo 服务已停止并清理临时 fixture；生产/真机控制面未提供，因此 E24、R1、R2 均保持 candidate，不提前提升 baseline。
- 新增 `rolo-artifact-analysis-summary/v1` 的 fail-closed parser、兼容性声明和 [ARTIFACT_ANALYSIS_CONTRACT.md](./ARTIFACT_ANALYSIS_CONTRACT.md)；现有真实设备投影先作为 `demo_fixture` 通过同一解析边界，未激活 API 请求。
- 新增超长文本、unsafe reference、secret flag、非法 run identity 的负向测试；`npm test` 当前 232 项通过。

## 已交付能力

1. Stack Map 为主入口，Overview、Fleet、Capabilities、Lifecycle、Wiki、Evidence 使用统一的证据/信任分层。
2. Episode Studio 已覆盖修订、对比、诊断、Cohort、Evidence occurrence/context、导航恢复和 review session；媒体、回放、导出、重采集和写操作仍未开放。
3. Jobs 只读界面和 `rolo-job-*/v1` 客户端已在 `main`，但仍由 `workbench.job-read-model/v1` feature gate 控制。
4. Run Analysis 已展示一份明确标注 `demo_fixture` 的脱敏真实设备 artifact 投影，并经过 versioned parser；尚不是通用 artifact 导入管线。
5. Target Readiness、Approval/Gate/Recovery 已接入严格解析器、分页 client、feature-gated 只读 UI 与 live gate 脚本；待真实控制面执行 live gate 后再提升 baseline。

## 开发顺序

### P0：完成 Job/R1/R2 真实控制面验收

前置已满足：rolo main `15e6b7d1` 已发布 Job、R1、R2 producer；rolo-vis consumer 已合入 `main`。

- 用真实 rolo 数据跑 Job、Target Readiness、Approval Gate 三组 live gate。
- 验证分页单调推进、重复/重叠页、Job/事件身份绑定、序列和时间戳异常均 fail closed。
- 验证旧版 rolo 不出现 Jobs 导航，不回退到 demo 数据，不构造命令或目标路径。
- 仅在三组 live gate 均通过后，分别将 `JOB_READONLY_CONTRACT`、`TARGET_READINESS_CONTRACT`、`APPROVAL_GATE_CONTRACT` 从 candidate 提升为 baseline，并补齐发布证据和版本号。

完成标准：真实控制面可读、feature 缺失时完全隐藏、所有 E24A/E24B 测试和 Sites 验证通过。

当前状态：消费者与 hardening PR 已完成；真实控制面 live gate 仍待执行，当前仍保持 candidate。

### P1：激活 R1 Target Readiness

前置已满足：rolo main `15e6b7d1`（PR #47）发布 `rolo-target-readiness-summary/v1` 与 `workbench.target-readiness/v1`。

- 在 Overview/Fleet/Jobs 之间复用同一份 target readiness 读模型，展示连接、主机密钥、平台/架构、workspace、companion 和 blocker 的独立状态。
- 明确 `READY` 只是 producer-owned readiness，不等同于 Job 成功、物理结果或 release readiness。
- 对超时、不可达、host-key 轮换、workspace 缺失和不支持平台保留原因与限制文本。
- 继续拒绝 SSH URI、用户名、私钥、workspace/raw path 与 bootstrap payload；不调用 `bootstrap-execute`。

完成标准：feature-negotiated UI、跨机器人切换和失效/部分读模型测试通过，未发布 feature 时零新增请求。

当前状态：consumer 已在 PR #23 合入；功能已可在 feature 宣布时激活，仍需真实控制面 live gate 才能晋级 baseline。

### P1：激活 R2 Approval/Gate/Recovery（只读）

前置已满足：rolo main `15e6b7d1`（PR #48）发布 `rolo-approval-gate-summary/v1`，并由 `/health` 宣布对应 feature gate。

- 展示 plan、approval、Gate、recovery 四个独立 producer-owned 维度，并绑定 opaque `job_id`/`target_id`。
- 从 Job、Target 和 Evidence 建立只读上下文跳转；不把 approval 或 Gate 结果合并成执行/发布结论。
- 保持 approval、resume/retry/cancel、rollback、release 等写权限在 rolo/CLI；浏览器不产生请求。
- 增加 secret-bearing payload、raw path、command args、未脱敏 transport output 的拒绝测试。

完成标准：只读审阅工作台可独立降级，任何恢复/审批动作都没有浏览器入口或 endpoint。

当前状态：consumer 已在 PR #23 合入；功能已可在 feature 宣布时激活，仍需真实控制面 live gate 才能晋级 baseline。

### P1：E26 设备侧加固外部验证

前置：P0/P1 读模型稳定，配套 rolo staging harness 可用。

- 按 `tests/fixtures/device-hardening-matrix.json` 执行 Linux ARM64/x86_64、离线安装、非 root/sudo、SSH jump host、host-key 轮换、网络中断、重启恢复、升级/回滚、enrollment rotation。
- 每个场景只收集脱敏的 OS/架构、签名包 digest、Job ID、Gate 结果和诊断摘要。
- 将缺失/失败场景保持为 `PENDING_EXTERNAL` 或 `BLOCKED`，禁止 UI 或 release metadata 推导成 READY。
- 把设备证据接入现有 Evidence ledger；不在浏览器执行 SSH、bootstrap、resume 或 rollback。

完成标准：矩阵中的外部证据可追溯且无凭据、raw path、artifact bytes 或未脱敏传输输出；再评估是否提升 E26 baseline。

### P2：产品化真实设备 artifact 分析

- 已完成第一步：`src/lerobotAnalysisData.ts` 的 demo 投影先经过 versioned、sanitized、可校验 parser；真实 producer 接入仍待 rolo 发布 endpoint。
- 复用 E24/E25 的 Job、Gate、Target、Evidence opaque ID，不允许前端读取任意文件或 artifact bytes。
- 增加 source provenance、时间新鲜度、partial/stale 状态和 schema compatibility；不把分析完成提升为 Operation、physical outcome 或 release 验证。
- 为真实 bundle、部分 bundle、哈希/身份不一致和过期 bundle 增加 fixtures、解析器测试和 live gate。

完成标准：真实 API 优先、API 不可用时明确 demo；没有 silent fallback、任意路径读取或权限边界放宽。当前状态：parser 与负向测试完成，producer endpoint/live gate 待 rolo。

### P3：体验与工程质量收口

- 对 Jobs/Readiness/Analysis 做键盘导航、焦点管理、窄屏布局、错误/空/加载态和 reduced-motion 复核。
- 处理当前 Vite 的单个 >500 kB chunk 警告，优先按页面做安全的 `dynamic import`/manual chunks，并用生产构建回归。
- 保持 `.openai/hosting.json`、Sites worker 和打包脚本不变；每个候选合并前运行 `npm run verify:baseline`。
- 只在产品合同另行批准后评估 Episode 媒体、回放、导出、重采集或任何写侧能力。

## 暂不合并与风险控制

- `codex/unified-agent-deployment-gui` 引入 authenticated deployment control，属于写侧部署/执行能力；它超出当前只读 MVP，不纳入本阶段合并。若未来要做，必须先有独立 producer contract、权限模型、审计与安全评审。
- 不从 Overview/Pipeline 推断 Target Readiness，不从 Agent/heuristic 推断 capability readiness，不从 artifact 分析推断物理结果。
- E24/E25/E26 的激活顺序必须保持“rolo 公共契约 → 客户端 fail-closed → feature gate → live gate → baseline promotion”，不能先用前端 fixture 冒充 live 成功。

## 每个阶段的交付闸门

1. 合同与 compatibility manifest 更新，并有负向安全测试。
2. 旧 rolo 版本保持兼容：feature 缺失时不请求、不显示、不混入 demo 数据。
3. `npm test`、`npm run typecheck`、`npm run build`、`npm run test:sites` 全部通过。
4. 对涉及 rolo endpoint 的阶段补充 paired-rolo live gate 和脱敏证据，再更新 roadmap/baseline 文档。
