---
name: nyxid-aevatar-channel-setup
description: 通过 NyxID 中的 Aevatar Service 创建、复用并核验用户指定平台的 Channel，按实际平台能力处理登录授权、接入资源、凭据和中断恢复。用于把消息渠道接入 Aevatar；通过 CLI/API 完成，无需 MCP 或代操作网页。
version: "1.1"
metadata:
  category: plain
---

# 通过 NyxID 创建 Aevatar Channel

帮助用户通过 NyxID 的 Aevatar Service 创建所需 Channel，不预设平台。**“NyxID 中的 Aevatar 服务入口”是 NyxID 服务列表中访问 Aevatar 后台 API 的那条配置；Channel 是通过它创建的资源。** 平台接入条件按当前 NyxID 与 Aevatar 的实际能力确定；Telegram、Slack、Discord、飞书等是可核对的平台示例，不是固定支持清单。

这是独立的单文件 Skill，无配套脚本或其他 Skill 依赖。执行时使用官方 `nyxid` CLI，必要时临时编写本地辅助代码。主流程通用于支持的渠道，平台特有操作只在对应分支执行。

## 交互原则

- 用户只要求设计时，不发起登录或创建。用户已要求执行且选择明确后直接推进，不重复索取确认。
- 复用已提供的平台、接入对象和授权信息，只问缺失项。接入对象可以是 Bot、应用或平台账号，按实际合同处理；用户未选平台时先确认，不默认 Telegram。选择和普通配置留在对话中。
- 不代操作网页。仅本人登录、注册、确认授权或第三方平台要求的操作需要用户打开对应入口；没有默认的“Aevatar 服务授权页”。
- 不让用户在聊天发送密码、MFA、token，不读取本机凭据文件。秘密不得进入命令参数、日志、普通输出或任务记录。
- 不自动覆盖 webhook、接管已有路由、扩大权限或删除资源。消息发送须另获授权，通常请用户自行发起测试。

## 1. 确定对象和环境

确认目标平台、已有接入对象的非敏感标识、NyxID 实例及个人或组织归属。只有目标平台要求 Bot 时才收集 Bot 标识；需要创建应用、安装到工作区或完成平台授权时，按该平台实际流程引导。Telegram 的 BotFather 操作见第四步平台分支。

复用用户选择的 NyxID 实例和 CLI profile。未配置实例时可说明托管入口 `https://nyx-api.chrono-ai.fun`，由用户选择。优先从 `PATH` 查找 `nyxid`，也可使用用户明确提供的客户端路径；不固定版本或安装位置。缺少 CLI 时使用[官方客户端安装器](https://raw.githubusercontent.com/ChronoAIProject/NyxID/main/skills/nyxid/scripts/install.sh)：下载检查后运行，不部署服务器、不接入其他凭据。

按本次分支核对 CLI 能力：登录需要 `login --no-wait`、`login resume --once`，Aevatar 请求需要 `proxy request --via-service`；平台登记参数通过 `channel-bot register --help` 核对，需要 token 时检查 `--token-env`。以下访问实例的 CLI 命令均附加：

```text
--base-url <本次实例> --profile <本次profile> --output json
```

在 Skill 目录之外记录非敏感任务进度：实例、profile、已验证账号、用户选择、授权请求句柄、写入尝试和资源 ID。写入前保存尝试标记；使用原子保存及进程锁，避免并发重复提交。记录文件权限设为 `0600`。

## 2. 检查授权；必要时引导登录或注册

先运行 `nyxid whoami`。授权有效则继续；账号会话的正常续期由 CLI 在后台调用接口完成，用户无需操作。

确认未登录时运行：

```text
nyxid login --no-wait
nyxid login resume <request_id> --once
```

第一条返回后，在对话中展示本次 `verification_uri`、`user_code` 和有效期。**用户自行打开 NyxID 授权页，登录并确认。** 不保存人类用户码；CLI 保管轮询秘密，任务只记录非敏感句柄。

没有账号时，先读取该实例 `GET /api/v1/public/config`，按实际 `frontend_url`、注册方式和邀请码要求引导用户注册，再回到原设备授权请求。不能仅凭支持某个社交登录就认定开放新用户注册。

用户说“已授权”后执行第二条并再次核对身份。pending 时保留同一请求、遵守轮询间隔；确认 expired 后保留业务进度，再发起新请求；denied 则停止。网络错误不等于登录失效。Agent Key 过期或权限不足不能按账号会话续期处理，也不能静默换成权限更大的身份。

## 3. 找到 Aevatar 入口，核对平台能力和运行服务

使用 `nyxid service list` 的 `keys[]` 发现实际 UserService，读取 `is_active`、`requires_connection`、`credential_missing` 和归属；不要用凭据的 `status` 代替服务启用状态，也不要把 catalog ID 当成 UserService ID。

已有唯一可用 Aevatar 实例就复用；多个实例在对话中选择；被 Disable 时按用户指示 Enable，不另建实例绕过。缺少实例则读取 `nyxid catalog list --all` 和 `catalog show <slug>`；目录确认无需额外凭据时可通过 `service add <slug> --output json` 接入并重新查询。不要强改认证方式来绕过真实要求。库存读取也可能自动补齐无需凭据的实例。

通过选定服务读取：

```text
GET /api/channels/me
GET /api/channels/services
GET /api/channels/registrations
```

个人归属时，Aevatar 的 `scope_id` 必须对应已验证的 NyxID 用户；组织归属时，先核对现网的组织 scope、访问权限和资源归属合同，不把个人流程中的用户 ID 直接替换为组织 ID。所有 Aevatar 请求固定通过当前实例：

```text
nyxid proxy request <实际服务slug> <接口路径> --via-service <实际UserService-ID>
```

结合 CLI 帮助、当前部署公开的能力描述/API 文档和已有注册，核对目标平台的接入方式、必填字段和 Aevatar 创建合同。CLI 提供 `channel-bot platforms` 时可用于发现 NyxID 平台能力；它不单独证明 Aevatar 支持该平台。`/api/channels/services` 是运行服务清单，不是平台支持清单。缺少平台声明时继续核对当前合同，不凭缺少 Telegram 示例以外的说明就判定不支持；明确不可用时报告具体缺失能力，不自动换平台。

从本次查询结果整理完整的可用运行服务候选清单，要求候选同时在 NyxID 和 Channel 服务列表中可用。注意 NyxID 使用 `is_active`、`credential_source.type`，Aevatar 服务列表使用 `active`、`credential_source.kind` 和 `credential_source.allowed`；同名个人/组织服务必须按实际 UserService ID 和归属区分。用途与权限优先读取服务描述、能力、API 文档及 `catalog show <实际catalog slug>` 的元数据；信息不足时标明待核对，不凭名称编造能力。

先读取完整清单再按实际 UserService ID 交叉核对，不先按熟悉的名称、slug 或上一轮推荐组合筛选。服务启用、凭据就绪和当前身份可授权分别判断：例如 `is_active=true` 且凭据 `status=pending_auth` 的实例仍需完成授权；`requires_connection=true` 本身不能证明已连接的凭据不可用。将未就绪、归属不符或可用性尚未查明的相关服务列入待处理项，并说明原因。

### 基础必选与扩展服务选择

新建 Channel 时，**LLM 和 Ornn 是基础必选项**：LLM 提供对话与推理能力，Ornn 提供技能能力。展示本次实际匹配的服务名称、归属和用途。用户已选定实例就复用；某类只有一个明确可用实例时可将其列为基础配置；存在多个 LLM 或多个归属的实例时，说明差异并让用户选择具体实例，不自动授权所有同类服务。基础项缺失或不可用时说明原因并处理连接/权限前提，不能静默省略后声称配置就绪。

**同时列出当前可用的扩展服务及推荐用途，不能只给 LLM 和 Ornn 就让用户盲选。** 用易读表格展示：服务名称及归属、能做什么、推荐场景或与用户需求的关系、授权范围和已知使用条件。根据目标用途优先推荐相关项，并保留其他可用候选；服务较多时按用途分组展示。用户只需按名称或编号选择，实际 UserService ID 在内部准确绑定。同名实例在展示中明确区分。

每个候选都要归入基础必选、推荐扩展、其他可选或能力待核对中的一项；推荐用于排序，不能让未推荐项从选项中消失。发送选择清单前按 UserService ID 检查覆盖是否完整，包括同一服务的不同归属实例。完整表过长时，对话展示推荐项，并提供其余候选的完整分组清单或可打开的本地文件；不能只以“等等”省略，也不能等用户逐个点名后才补充。能力信息不足的候选应显示已知信息和具体待核对项，不能因不熟悉就静默丢弃。

创建 Channel 时使用的服务入口，与 Bot 运行时获准调用的服务分别判断。某个服务既可能用于本次配置，也可能提供用户需要的运行能力；它仍须进入上述候选清单，不能因已用于接入就排除，也不能因此自动加入 Bot 的授权。是否推荐取决于当前服务的实际能力和用户用途，不为某个产品名称单独补例外。此规则不改变用户已选择的接入目标，也不把此 Skill 扩展为任意平台的接入流程。

推荐必须来自实际清单。例如，清单中确有对应服务时，可推荐搜索/网页抓取用于资料查询、代码托管用于仓库协作、文档服务用于知识查询、沙箱用于代码执行。说明实际支持的读写或执行能力、个人/组织归属，以及已知的额外授权或费用条件；不把这些例子写成每个账号都有的固定选项。与用户需求相关但尚未连接或当前不可用的服务，可另外说明前置条件，不混入可立即授权的候选。

扩展项由用户选择；推荐不等于已获授权。可提供“仅使用基础项”的选项，不能因用户尚未回复就自动启用推荐项或跳过扩展选择。用户已明确只要基础能力，或已给出完整服务选择时，沿用其决定并直接推进。最终展示基础项与所选扩展项的简明摘要，保存对应的非空 UserService ID 集合，作为创建时的 `service_ids` 及第六步的权限核验依据，不套用过去账号的 ID，也不授权全部服务。

复用已有 Channel 时，保存已核对的现有授权集合作为验收基线，展示它与上述建议的差异，不因基础或推荐项规则静默增加授权；用户明确要求调整权限时再更新目标集合。读取成功不代表有权创建接入资源、专用 Key 和路由；权限不足时报告具体失败环节。

## 4. 按平台准备或复用接入资源

当前 NyxID Channel Bot 接入路径先用 `nyxid channel-bot list` 查找，必要时 `channel-bot show <id>` 核对平台、平台对象 ID、用户名或应用/账号标识、归属及有效状态。不同平台在 NyxID 中可统一表示为 Channel Bot，不要求它们都具备 Telegram 用户名。已登记且可接入的资源直接复用 ID，不重复索取凭据；已绑定的 Channel 先查询现状。

未登记时，根据第三步确认的接入方式执行：

- **用户提供凭据**：仅收集该平台必需的 token、应用秘密或验证材料，由用户在**自己的交互终端隐藏输入**。辅助代码核对平台身份和已有接入配置，再通过 CLI 的秘密环境变量参数或受支持 API 的 stdin 请求体登记。命令显式指定本次实例和 profile，不能将秘密放入 argv；CLI 缺少安全输入方式时不降级为明文参数。
- **平台托管或 OAuth 授权**：使用实际提供的授权入口，由用户完成平台登录、同意或安装；回读产生的连接与接入资源，核对归属，不要求用户另交 token。
- **回调或事件订阅配置**：按平台要求处理 webhook、签名验证、事件订阅或轮询。保护已有接入配置；不能对所有平台套用 Telegram 的 webhook 检查，也不能要求轮询平台必须登记 webhook。需要用户配置平台控制台时，提供真实入口和非敏感步骤，秘密通过本地受保护方式交接。

所有登记响应内部捕获，只输出并保存经过字段筛选的资源 ID、平台标识和状态，过滤 webhook secret 等秘密；立即回读身份和归属。辅助代码不保存用户输入的秘密。交给用户的运行命令必须是完整、已引用转义的实际路径和参数，不能依赖 agent 终端里的临时变量；不要假设新开的终端面板连接了 agent 的输入会话。

### Telegram 分支：用户提供 Bot token

仅在目标是 Telegram 且采用用户提供 token 的方式时执行。没有 Bot 时引导用户到官方 [BotFather](https://t.me/BotFather) 使用 `/newbot` 创建，只需向对话提供用户名。本地辅助代码按顺序：

1. 用无回显输入取得 token；无法隐藏输入则停止，不能降级为普通输入或让用户贴到 shell 提示符。
2. 调用 Telegram `getMe` 核对目标 Bot，再用 `getWebhookInfo` 检查既有 webhook。有现成 webhook 时停止并说明影响，不自动覆盖。
3. 把 token 仅放入 NyxID 子进程的临时环境，通过 `channel-bot register --platform telegram --label <标签> --token-env <变量名>` 登记。调用中显式指定本次实例和 profile。
4. 按上述通用规则筛选回执，回读 Bot；Telegram 用户名字段为 `platform_bot_username`。

Telegram token 在 URL 中时，使用进程内 HTTP 客户端或 curl 的 stdin 配置传入，不能出现在 argv 或异常输出。其他平台使用其实际身份与接入检查接口，不调用这组 Telegram API。

## 5. 经 Aevatar 创建 Channel

按第三步确认的现网合同创建。采用 NyxID Channel Bot 接入路径时，核对资源没有需要保护的既有默认路由：`nyxid channel-bot route list --bot-id <id>`。如果已有 Aevatar 绑定，直接检查该注册；不要重复创建或静默改权限。

该路径生成并提前记录本次 `registration_id`，然后通过选定的 Aevatar 服务入口提交一次；以下为已验证的请求形状，目标平台需要的额外字段以现网合同为准：

```text
POST /api/channels/registrations
Content-Type: application/json
```

```json
{
  "registration_id": "<本次新生成的UUID十六进制字符串>",
  "nyx_channel_bot_id": "<已核对的NyxID Bot ID>",
  "service_ids": ["<用户选定的运行服务UserService-ID>"]
}
```

CLI 用 `-m POST -H 'Content-Type: application/json' -d -` 从 stdin 读取 JSON。**此合同要求先登记 NyxID 接入资源，再由 Aevatar 接入其 `nyx_channel_bot_id`；不要使用直接向 Aevatar 提交 `bot_token` 的旧格式。** 如果目标渠道使用现网另行声明的接入合同，按其已核实的接口和资源引用处理，仍通过选定的 Aevatar Service 创建，不编造接口或把 Telegram 字段强加到其他平台。原始响应内部处理，只保留非敏感回执。NyxID 资源标签和 Aevatar 注册标签可能不同。

## 6. 独立核验，再报告结果

`accepted` 只是请求已接收。重新读取注册详情及状态：

```text
GET /api/channels/registrations/<registration_id>
GET /api/channels/registrations/<registration_id>/status
```

对上述 NyxID Channel Bot 接入路径，再查询 Bot、路由和 `nyxid api-key show <关联Key-ID>` 的非敏感元数据，确认：注册/平台资源/归属关联一致，状态 active、`binding_status=bound`，默认路由启用且关联正确，专用 Key ready/有效，实际服务权限精确匹配第三步保存的目标集合（新建为基础项与用户所选扩展项；复用为已核对的授权基线或用户明确要求的新集合），并检查工作流结果投递配置。关联字段包括 `nyx_agent_api_key_id`、`nyx_conversation_route_id`，投递配置为 `workflow_result_delivery_status`。精确授权同时检查 `allow_all_services=false`、`allow_auto_connected_services=false`、`allow_all_nodes=false` 和 `allowed_node_ids=[]`；合同缺少字段时先核对含义，不将缺失自动当作 false。

平台接入就绪按其机制验收：webhook 平台核对登记及必要的验证/订阅状态，轮询平台核对连接和轮询状态，其他机制按现网就绪条件处理。不用 `webhook_registered` 作为所有平台的统一成功门槛。另一接入合同则使用对应的状态接口与关联字段。

结果分别标明“已接收”“已创建”“配置就绪”，注明本次是新建还是复用，只报告已证实的阶段。返回该平台实际可用的会话入口或打开方式、当前状态及剩余操作；Telegram 可返回 `https://t.me/<Bot用户名>`。真实消息收发单独验证：请用户在目标渠道发起测试消息；配置标志不代表已成功回复。

## 验证覆盖说明

已实测的创建与配置路径为 Telegram＋个人 NyxID 账号会话；这一记录描述测试覆盖，不限定 Skill 的平台范围。其他平台、组织归属和受限身份按上述流程核对实际能力，并如实记录本轮完成的创建、复用、配置核验和真实收发阶段，不能把 Telegram 的成功结果当作其他平台的验证证据。

## 中断和失败时

- 平台接入资源登记成功、Channel 尚未创建：复用已验证的资源 ID，继续后一步。
- 写入超时或响应丢失：先按记录的注册 ID、平台对象身份及归属查询结果。暂时 404 或未查到不能立即判定未创建；不删除尝试记录、重新分配 ID 或盲目重发 POST。
- 明确拒绝或合同变化：保留非敏感错误与尝试，核对现网合同和已有资源后决定修正。不要把旧前端代码当成现网接口依据。
- 只对明确暂时性的只读网络/502/503/504失败做有限重试；认证拒绝、TLS错误及资源写入不盲目重试。配置未就绪继续查原资源，不能用再次创建代替修复。
