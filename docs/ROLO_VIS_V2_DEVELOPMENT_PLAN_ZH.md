# rolo-vis v2 开发计划

> 状态：Active · 计划版本：v2 · 最近复核：2026-09-03  
> 配对后端计划：[rolo-v2 总开发计划](../../../../rolo-v2/.worktrees/rolo-v2-workbench/docs/architecture/ROLO_V2_DEVELOPMENT_PLAN_ZH.md)

本计划是 `rolo-vis-v2` 的消费端执行计划，与 rolo-v2 后端使用相同的 R0–R8 里程碑。任何一个阶段只有在前后端契约、实现和证据同时满足时，才可以标记为完成；不再为旧版接口保留兼容性分支。

## 产品边界

- **Tool Surface 是首要信息面**：用户首先看到 MHS 的发现、注册、驱动身份、验证状态，以及哪些 Tool 已经可以被后续 Agent 调用。
- **RKB 是机器人状态全貌**：身份、运行时、硬件、Middleware、Capability、Executable、State & Safety 和 Episodes 都以只读投影呈现；未知、过期和缺失必须显式标注。
- **Agent 可调用性是有条件的**：只有正式 conformance 结果、目标绑定的 session digest、manifest/driver digest 和当前 freshness 均满足时，Tool 才能显示为 `VERIFIED / AGENT-CALLABLE`。
- **MVP 保持只读**：不加入遥操作、任意 shell、任意文件浏览、写操作或绕过 rolo runtime policy 的入口。

## R0–R8 同步路线图

| 阶段 | rolo-vis-v2 交付 | 配对后端依赖 | 完成门 |
| --- | --- | --- | --- |
| **R0 基线** | 固定 v2 信息架构、状态枚举、错误/降级文案和视觉密度；冻结 `/workbench/`、`/rolo-api/` 入口约定。 | v2 envelope、RKB 只读边界 | 设计与契约评审通过，旧版兼容目标移除 |
| **R1 Envelope** | 客户端解析 robot identity、snapshot、freshness、provenance、digest；拒绝不安全引用和未知状态。 | RKB snapshot storage/envelope | 合同测试覆盖正常、过期、未知、篡改和部分数据 |
| **R2 Typed read models** | `rkb`、`mhs`、`tools` 客户端方法和严格 parser；分页、错误、空集、demo fallback 均有明确呈现。 | RKB/MHS/Tool typed query | TypeScript 类型检查与 parser contract tests 通过 |
| **R3 MHS registry** | Tool Surface 展示 discovered → registered 生命周期、provider、manifest digest、driver digest、route、freshness 和注册失败原因。 | 持久化 MHS Provider registry + registration lifecycle | 同一 provider 的注册/注销/漂移可追踪；UI 不再从硬件资源猜测注册状态 |
| **R4 Tool verification** | 分离 `DISCOVERED`、`VERIFIED`、`STALE`、`UNKNOWN` 和 `REJECTED`；突出 Agent-callable 数量与不可调用原因。 | `agent_tools.conformance` artifact + target-bound session digest | conformance、目标身份、session、digest、freshness 全部匹配才显示 callable |
| **R5 Runtime host** | 接入真实同源 `/workbench/` 与 `/rolo-api/`；加载、超时、部分成功、认证失败和 backend unavailable 有可操作但只读的状态面。 | `rolo.api:app` 接入 `robotctl runtime serve` 实际监听器和 trusted reverse proxy | 本地 runtime 与反向代理 canary 均能访问同一来源，禁止前端直连旁路接口 |
| **R6 RKB/Episodes** | RKB 全量分区、状态时间线、provenance 链和 Episode read model；支持从 Episode → Capability/Tool/MHS 交叉定位。 | Episode read model、事件/快照 provenance contract | Episode 缺失、截断、过期时有明确降级；每个结论可回溯来源 |
| **R7 v2 package** | 生成并校验 `SHA256SUMS`，严格检查 manifest、入口和资源；清理旧 `App.tsx`、历史 contracts/tests（若无兼容需求），保留 Sites 所需文件。 | rolo-v2 package/manifest 发布门 | `npm run typecheck`、`npm run test:v2`、`npm run build`、`npm run test:sites` 全通过 |
| **R8 Real-device canary** | 使用真实 RKB snapshot、真实 MHS provider、driver digest 漂移、STALE/UNKNOWN、session 失效和 trusted proxy 做端到端验证；记录截图与审计证据。 | 真机 runtime、registry、conformance、proxy | canary 通过后才发布；失败时回滚到只读 demo mode，不隐藏不确定性 |

## 执行顺序与责任

```text
R0 → R1 → R2 → (R3 + R4) → R5 → R6 → R7 → R8
                         ↘ contract fixtures ↗
```

- **rolo-v2 负责事实与信任链**：envelope/storage、typed query、MHS registry、conformance、runtime host、Episode read model 和真机证据。
- **rolo-vis-v2 负责可见性与消费约束**：严格解析、Tool Surface/RKB 交互、降级呈现、同源部署、视觉验收和 package integrity。
- 两端共享同一组 feature id：`rkb.read-model/v1`、`mhs.inventory-read-model/v1`、`tool.verification-read-model/v1`。变更必须同步更新后端契约、`src/types/rolo.ts`、`src/contracts/rkb.ts`、`src/roloClient.ts` 和测试 fixtures。

## 当前实现与剩余工作

当前已完成 v2 Workbench shell、Tool Surface、RKB 分区、Episodes 摘要区与详情、严格 read-model parser、
客户端 feature gating、FastAPI read-only facade 候选实现、conformance 状态消费和 SHA256 package
生成。Episode 详情已经支持资产/发现展开、Evidence 交叉定位、revision selector、旧 revision 与 current
revision 的计数对比，以及 timeline 截断提示。以下项目仍是开发计划中的未完成项：

1. 将 `rolo.api:app` 接入 rolo-v2 runtime 的实际监听器，并完成 `/workbench/` 与 `/rolo-api/` 同源挂载。
2. 用真正持久化的 MHS Provider registry、manifest digest、driver digest 和 registration lifecycle 替换当前 projection。
3. 接入正式 `agent_tools.conformance` 结果和 target-bound session digest，重新计算 `VERIFIED / AGENT-CALLABLE`。
4. 将 Episode provenance graph 扩展为跨 RKB、Tool、MHS 的实体级导航，并补齐 revision comparison 的逐项差异。
5. 在确认无兼容需求后，物理删除旧 `App.tsx`、历史 contracts 与旧测试目录；Sites 保留文件不动。
6. 进行真实设备与 trusted reverse proxy canary，验证 digest 漂移、STALE/UNKNOWN、认证失败和 runtime 不可用等降级路径。

### 本轮同步状态（2026-09-03）

- Tool Surface 继续保持 discovery、registration、verification、Agent-callable 的独立
  状态，不把注册误读为可调用。
- Episode 详情只有在后端发布并完成 schema/provenance 校验后才进入 UI；缺失、截断或
  未验证的事件/资产/发现保持 limitation，不用 demo 数据冒充生产证据。
- Episode 详情面板已完成浏览器 smoke audit：资产/发现展开、Evidence 跳转、revision
  selector、comparison 摘要和 timeline 截断降级均可见；无 Episode publication 时保留
  明确的空状态。
- R8 仍是外部部署门槛：真实 Provider discovery、target fingerprint/conformance
  artifact、trusted reverse proxy 与真机 canary 未在本地工作树中宣称完成。

## 质量门与发布规则

- 前端每个阶段必须有 parser/contract test；涉及状态映射时必须有 `UNKNOWN` 和 `STALE` fixture。
- 任何 `AGENT-CALLABLE` 文案必须能在详情中显示 conformance artifact、session digest、target identity 和最近验证时间。
- 不能用 demo fixture 掩盖 live 请求失败；demo mode 必须有明显标签，并显示缺失的 live evidence。
- 发布前必须在两个工作树分别运行各自的检查，并在计划中记录 commit、测试结果和真机证据链接。
- 若 rolo-v2 改变 endpoint、feature id、状态枚举或 digest 规则，先更新配对计划，再更新实现；不同步的任一端不得宣称 v2 ready。

## 非目标

本计划不包含 teleoperation、机器人控制写入、任意命令执行、任意文件浏览、绕过 runtime policy 的调试后门，也不承诺旧 rolo-vis API 的兼容层。
