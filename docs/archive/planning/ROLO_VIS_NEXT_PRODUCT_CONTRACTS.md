# rolo-vis 下一版产品合同评估

状态：评估中；不改变当前只读 MVP 权限边界

本文把 P3 的潜在能力拆成独立候选合同。任何候选在进入开发前，都必须完成公共
producer contract、feature negotiation、scope、审计模型和安全评审；不得通过现有
read-model 推断出新的执行或发布权限。

## 候选 A：Episode media / replay metadata

目标：在 Episode Studio 中展示受控媒体或回放索引的元数据。

必须先定义：

- producer-owned `media_id`、Episode revision、时间窗口和内容摘要；
- 媒体能力、下载能力、回放能力分别协商，默认关闭；
- 内容服务的授权、过期、撤销和审计语义；
- 浏览器永远不接收原始 artifact 路径、凭据或未授权 URL。

明确不包含：浏览器端重采集、实时控制、自动播放、媒体下载或物理结果推断。

## 候选 B：Evidence export

目标：导出一份可审阅的脱敏证据索引，而不是导出原始 artifact。

必须先定义：

- export manifest schema、范围、版本锁定和内容 digest；
- 用户主动触发、确认和审计记录；
- 导出内容只包含 opaque IDs、状态、时间戳、limitations 和脱敏摘要；
- 导出失败、过期和撤销的稳定错误码。

在独立合同通过前，rolo-vis 不增加下载 endpoint、文件写入或剪贴板自动导出。

## 候选 C：受控写侧操作

目标：评估审批、resume/retry/cancel、bootstrap 或 rollback 的 UI 入口。

该候选不属于当前 MVP，必须额外完成：

- 明确的 command contract、scope separation、双重确认和幂等语义；
- rolo-owned authorization、审计、回滚和超时策略；
- 浏览器不得携带 secret payload，不得拼接任意 argv，不得绕过 rolo policy；
- staging/真实设备验证和安全评审通过后，才能进入独立版本线。

## 评估闸门

候选只有在以下条件全部满足后才可排期：

1. schema、endpoint、feature、scope 和错误语义已发布并有兼容矩阵；
2. 正向、负向、身份漂移、权限不足、过期和重放测试齐全；
3. paired runtime 与真实 staging 证据可重复，且不包含凭据、raw path 或 artifact bytes；
4. rolo-vis UI 明确区分 advisory、verification、outcome 和 release authority；
5. `npm run verify:baseline`、Sites 打包和安全评审均通过。

当前建议：先完成 E26 外部证据与现有 Job/R1/R2/Artifact Analysis baseline promotion，
再从候选 A/B 中选择一个做独立 R3；候选 C 暂不进入当前开发线。
