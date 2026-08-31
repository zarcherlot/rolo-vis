# rolo 团队开发项与外部收口清单

更新时间：2026-08-31
目标：为 rolo 团队明确哪些事项需要进入 rolo 工程，哪些事项只需在 rolo
staging/运行时执行即可提供给 rolo-vis。

## 结论

rolo-vis 已完成消费者侧 parser、feature gate、live gate 命令、脱敏证据 bundle
校验和验收文档。以下“工程开发项”需要进入 rolo 的代码、schema、测试或发布配置；
staging 地址、短时 token、真实设备证据和 live gate 输出则是部署后的运行时产物，
不应作为 rolo-vis 的代码变更。

## 必须进入 rolo 工程的开发项

### ROL-EXT-01：固定 staging harness 与可重复执行入口

交付：

- 固定 rolo release/producer revision、目标 profile 和测试包来源。
- 提供可重复执行的 staging harness/CLI 入口，覆盖 R0 Job、R1 Target Readiness、
  R2 Approval/Gate/Recovery、R4 Artifact Analysis。
- 每次执行输出 opaque `target_id`、`job_id`、producer revision 和稳定 gate result。
- 执行失败时保留 `BLOCKED` 或 `PENDING_EXTERNAL`，不得推导为 READY。

验收：同一版本在相同目标上重复运行，结果 schema、身份绑定和失败语义稳定；不允许
浏览器直接触发 harness。

### ROL-EXT-02：发布脱敏 device evidence bundle

交付：实现或固化 `rolo-vis-device-hardening-evidence/v1` 的 producer/export 适配，
至少能够导出以下字段：`release_line`、`rolo_revision`、`producer_revision`、
opaque `target_id`/`target_kind`、scenario `status`，以及 VERIFIED 项的 OS、架构、
签名包 digest、opaque Job ID、gate result、时间戳和脱敏摘要。

验收：bundle 可被 rolo-vis 的 `npm run check:device-hardening-evidence -- <bundle>`
校验；拒绝私钥、token、SSH URI、known-hosts、raw path、命令参数、transport dump
和 artifact bytes。当前校验器位于
`src/contracts/deviceHardeningEvidence.ts`，不可用未审计 fixture 代替真实证据。

### ROL-EXT-03：公共 contract / feature gate / scope 一致性

交付：

- `/health.api_features` 与实际 endpoint、schema registry 和 API 文档一致。
- R0/R1/R2/R4 的 read scope 与写 scope 分离，短时 token 不能获得浏览器写权限。
- 分页、revision、404/409/422、身份不匹配和 schema mismatch 语义写入兼容矩阵。

验收：旧版 rolo-vis 在 feature 缺失时零新请求；feature 开启但 payload 不兼容时
客户端 fail-closed。

### ROL-EXT-04：producer 负向安全测试与发布门禁

交付：在 rolo CI 中覆盖 secrets/raw path/SSH 信息泄漏、跨 target/job 绑定、revision
漂移、分页回退、超大摘要、未知状态和 artifact identity mismatch；发布流程阻止未
通过测试的 producer 进入 staging。

验收：测试结果和 rolo commit 可追溯，失败项进入 release ledger，不通过汇总层隐藏。

### ROL-EXT-05：证据追溯与 release ledger

交付：将每个 scenario 绑定到 rolo release、target identity、producer revision、Job ID、
package digest、观察时间和限制说明；支持人工 review 记录和失败项留档。

验收：任何 VERIFIED 项都能回溯到受控 staging 原始记录，但公开 bundle 只保留脱敏摘要。

## 不需要新增 rolo 代码的运行时事项

以下事项在 ROL-EXT-01～05 就绪后，通过部署和受控执行即可提供：

1. staging control-plane 地址；
2. 具备最小 read scope、短时有效的 API token；
3. Linux ARM64/x86_64、离线安装、非 root/sudo、SSH jump host、host-key rotation、
   网络中断、重启恢复、升级/回滚、enrollment rotation 的真实执行结果；
4. R0/R1/R2/R4 live gate 输出和人工 review 结论。

这些产物不应提交 token、私钥或原始日志到 Git；通过受控渠道交给 rolo-vis 即可。

## rolo 团队交接顺序

1. 先完成 ROL-EXT-01～04，并在 rolo CI 合入。
2. 部署固定 revision 到 staging，签发短时 read-only token。
3. 执行 R0/R1/R2/R4 live gate，导出脱敏 bundle，完成人工 review。
4. 将 bundle、gate 摘要、失败与限制交给 rolo-vis。
5. rolo-vis 运行 bundle 校验和 `npm run verify:baseline`；所有外部场景通过后，双方再讨论 candidate → baseline promotion。

## 当前状态

- rolo R1 PR #47、R2 PR #48、Artifact Producer PR #49/#50 已合入 rolo `main`。
- rolo-vis PR #30 包含本清单、外部收口手册和 fail-closed bundle validator。
- 当前阻塞是 staging endpoint、短时 token 和真实设备证据尚未提供，不是 rolo-vis
  消费者代码缺失。
