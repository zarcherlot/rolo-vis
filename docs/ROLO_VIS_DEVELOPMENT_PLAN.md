# rolo-vis 后续开发计划

更新时间：2026-08-30

## 当前基线

- `main` 基线仍为 `d3c570d`（`feat: surface real device artifact analysis`）；E24 消费者已整理到 `codex/e24-job-read-model-consumer`，commit `8dd1251`，并已推送远端。
- 本次环境无法写入 `.git/FETCH_HEAD`，所以 `git fetch` 被权限拒绝；现有远端跟踪引用已与本地一致，未发现可合并提交。
- 同级 rolo 仓库当前 checkout 仍在 `codex/p1-dev10-harness-template`，未跟踪临时目录保持不变；其未检出的本地 `main` 已同步到最新 `origin/main` `780d7a5`，现在 `main...origin/main` 为 `0/0`。
- rolo `origin/main` 已提供并宣布 `workbench.job-read-model/v1`，且包含 `/v1/jobs`、`/v1/jobs/{job_id}`、`/v1/jobs/{job_id}/events`、只读 `bootstrap-plan`、Verify readiness 和 stage authorization 读接口。远端日志确认 E24 已由 PR #38 合入、E23 Workbench 已由 PR #39 合入、文档刷新由 PR #40/#43 合入，Adapt evidence slice hardening 由 PR #42 合入；旧 E23/E24 远端分支引用已自动清理。Readiness/Gate 仍没有与 E24C/E25 提案完全同名的公共 feature contract。
- `npm run verify:baseline` 已通过：225 个应用测试、TypeScript、生产构建、Sites 打包测试全部通过。
- 当前版本为 `0.37.0`，已冻结 Episode Observation Bundle（E22）只读基线。

## 本轮推进（2026-08-30）

- 补齐 `rolo.plugin.json` 的 `job.history.read` 能力声明和三个 `/v1/jobs*` 只读 endpoint。
- Job Inbox 增加事件分页、独立加载状态和跨页 event/job ID 去重；feature 缺失时仍完全隐藏且不发请求。
- 已同步 rolo 本地未检出的 `main` 到 `origin/main` `780d7a5`，未切换当前 checkout，也未触碰临时目录。
- `codex/e24-job-read-model-consumer` 已提交并推送，作为 rolo-vis 侧待合入分支；GitHub CLI OAuth 仍不稳定，PR 尚未自动创建，但可直接使用 compare 链接。
- rolo-vis 消费者分支 compare：[codex/e24-job-read-model-consumer](https://github.com/zarcherlot/rolo-vis/pull/new/codex/e24-job-read-model-consumer)。
- 已补充 `scripts/check-job-read-model.mjs` 与 `npm run check:job-live`：只读检查 feature 协商、Job/事件分页、身份绑定、recovery 一致性及敏感字段；当前因本机 `127.0.0.1:8080` 未启动 rolo，live gate 按 `NETWORK /health` fail-closed。
- 已完成 P3 分包优化：React、Flow、图标和 artifact 数据独立成 chunk，主 JS 约 381 kB；完整 `npm run verify:baseline` 通过（225 tests、typecheck、build、Sites 4 tests）。
- 本机 `127.0.0.1:8080` 未启动 rolo 控制面，因此 E24 live gate 暂不能执行；本轮只完成安全边界和消费者实现，未把 candidate 提升为 baseline。

## 已交付能力

1. Stack Map 为主入口，Overview、Fleet、Capabilities、Lifecycle、Wiki、Evidence 使用统一的证据/信任分层。
2. Episode Studio 已覆盖修订、对比、诊断、Cohort、Evidence occurrence/context、导航恢复和 review session；媒体、回放、导出、重采集和写操作仍未开放。
3. Jobs 只读界面和 `rolo-job-*/v1` 客户端已在 `main`，但仍由 `workbench.job-read-model/v1` feature gate 控制。
4. Run Analysis 已展示一份脱敏的真实设备 artifact 投影；当前数据仍是前端静态投影，不是通用 artifact 导入管线。
5. Target Readiness、Approval/Gate/Recovery 已有严格解析器和测试，但尚无可激活的公共 rolo endpoint。

## 开发顺序

### P0：完成 E24 Job 只读基线

前置：以 rolo `origin/main` `780d7a5` 为 paired producer baseline，将 rolo-vis 消费者分支合入并把 `/v1/jobs` 三个接口的响应与 E24 schema 逐字段对齐；`npm run check:job-live` 通过后再提升 baseline。

- 用真实 rolo 数据跑 Job Inbox、Job detail、Event timeline、Checkpoint/recovery 的 live gate。
- 验证分页单调推进、重复/重叠页、Job/事件身份绑定、序列和时间戳异常均 fail closed。
- 验证旧版 rolo 不出现 Jobs 导航，不回退到 demo 数据，不构造命令或目标路径。
- 将 `JOB_READONLY_CONTRACT` 从 candidate 提升为 baseline，并补齐发布证据和配套版本号。

完成标准：真实控制面可读、feature 缺失时完全隐藏、所有 E24A/E24B 测试和 Sites 验证通过。

当前状态：消费者与门禁已完成，等待 rolo-vis PR 合入和真实控制面 live gate；不可用时保持 candidate。

### P1：激活 E24C Target Readiness

前置：rolo 发布 `rolo-target-readiness-summary/v1` 与 `workbench.target-readiness/v1`。现有 Verify readiness 和 `bootstrap-plan` 只能作为候选输入，不能由前端自行拼装成该 contract。

- 在 Overview/Fleet/Jobs 之间复用同一份 target readiness 读模型，展示连接、主机密钥、平台/架构、workspace、companion 和 blocker 的独立状态。
- 明确 `READY` 只是 producer-owned readiness，不等同于 Job 成功、物理结果或 release readiness。
- 对超时、不可达、host-key 轮换、workspace 缺失和不支持平台保留原因与限制文本。
- 继续拒绝 SSH URI、用户名、私钥、workspace/raw path 与 bootstrap payload；不调用 `bootstrap-execute`。

完成标准：feature-negotiated UI、跨机器人切换和失效/部分读模型测试通过，未发布 feature 时零新增请求。

### P1：激活 E25 Approval/Gate/Recovery（只读）

前置：E24 Job 与 Target Readiness 已稳定；rolo 当前的 stage authorization、bootstrap-plan、Job recovery 输出需先收敛为 `rolo-approval-gate-summary/v1`，并由 `/health` 宣布对应 feature gate。

- 展示 plan、approval、Gate、recovery 四个独立 producer-owned 维度，并绑定 opaque `job_id`/`target_id`。
- 从 Job、Target 和 Evidence 建立只读上下文跳转；不把 approval 或 Gate 结果合并成执行/发布结论。
- 保持 approval、resume/retry/cancel、rollback、release 等写权限在 rolo/CLI；浏览器不产生请求。
- 增加 secret-bearing payload、raw path、command args、未脱敏 transport output 的拒绝测试。

完成标准：只读审阅工作台可独立降级，任何恢复/审批动作都没有浏览器入口或 endpoint。

### P1：E26 设备侧加固外部验证

前置：P0/P1 读模型稳定，配套 rolo staging harness 可用。

- 按 `tests/fixtures/device-hardening-matrix.json` 执行 Linux ARM64/x86_64、离线安装、非 root/sudo、SSH jump host、host-key 轮换、网络中断、重启恢复、升级/回滚、enrollment rotation。
- 每个场景只收集脱敏的 OS/架构、签名包 digest、Job ID、Gate 结果和诊断摘要。
- 将缺失/失败场景保持为 `PENDING_EXTERNAL` 或 `BLOCKED`，禁止 UI 或 release metadata 推导成 READY。
- 把设备证据接入现有 Evidence ledger；不在浏览器执行 SSH、bootstrap、resume 或 rollback。

完成标准：矩阵中的外部证据可追溯且无凭据、raw path、artifact bytes 或未脱敏传输输出；再评估是否提升 E26 baseline。

### P2：产品化真实设备 artifact 分析

- 将 `src/lerobotAnalysisData.ts` 的静态投影替换为 versioned、sanitized、可校验的 read model；保留当前数据作为明确标注的 demo fixture。
- 复用 E24/E25 的 Job、Gate、Target、Evidence opaque ID，不允许前端读取任意文件或 artifact bytes。
- 增加 source provenance、时间新鲜度、partial/stale 状态和 schema compatibility；不把分析完成提升为 Operation、physical outcome 或 release 验证。
- 为真实 bundle、部分 bundle、哈希/身份不一致和过期 bundle 增加 fixtures、解析器测试和 live gate。

完成标准：真实 API 优先、API 不可用时明确 demo；没有 silent fallback、任意路径读取或权限边界放宽。

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
