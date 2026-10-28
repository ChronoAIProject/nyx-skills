# 建订位专员

接入的最后一段在 NyxID 里做，用 NyxBot 自己的原生工具（建专员、改专员、设技能、设渠道）。每个会弹确认卡的动作都让老板确认，不绕开。

## 1. 查重

先列出现有专员。已有同一家店（店名相同）的订位专员，就更新它的 Role、授权和技能，不建第二个。别的店的订位专员不算重名，照常新建，不动它。

## 2. 建专员

- 名称：老板起的名字，没有就叫「店名订位助手」。
- Role：`role-snippet.md` 的固定模板，只填店名和订位登记表 ID，其他不改（约 1300 字符）。顾客回合读不到技能，顾客流程在 Role 里，店铺规矩在「餐厅设置」里。
- Persona：一两句语气和语言习惯，不放规矩。

建专员失败时，读失败原因：如果提示缺额度或权限，原样告诉老板并停在这一步，已建的文件保留；不要换一种工具反复重试。

## 3. 授权 Google Workspace

给专员授权 `api-google-workspace`。默认是自动确认，访客（顾客）权限设为 `all`：顾客回合要往订位登记追加行，追加行属于破坏性操作，需要 `all`。

| 老板的规矩 | 访客级别 | 「餐厅设置」待确认类别 |
|---|---|---|
| 默认：有余量就自动确认 | `all` | 无 |
| 某类订位要老板先过目（如包间） | `all` | 那一类，例如「包间」「8人以上」；其余照样自动确认 |
| 老板明确说所有订位都要他确认 | `all` | 全部（每单都记一行待确认，老板说「批准」后才改已确认） |

### 操作范围（必做）

授权服务后，专员在老板回合能调用哪些接口还受「操作范围」限制。NyxBot 建专员时常把范围收得很窄（例如只放行几个 Sheets 接口），日历就写不进去。用 `get_agent_operations` 读出专员在 `api-google-workspace` 上的范围，用 `set_agent_operations` 设成下面这些（老板确认卡照常出现），老板回合和访客回合都要包含：

| 用途 | 接口 |
|---|---|
| 读表 | `GET /v4/spreadsheets/{spreadsheetId}`、`GET /v4/spreadsheets/{spreadsheetId}/values/{range}` |
| 写表 | `PUT /v4/spreadsheets/{spreadsheetId}/values/{range}`、`POST /v4/spreadsheets/{spreadsheetId}/values/{range}:append` |
| 包间日历（有包间时） | `GET`、`POST /calendar/v3/calendars/{calendarId}/events`；`GET`、`PATCH`、`DELETE /calendar/v3/calendars/{calendarId}/events/{eventId}` |

不放开删表、清空、建删日历、Drive 文件操作。设完再读一次，确认这些接口都在。

交付时提一句：顾客回合可以写这个 Google 账号里的表格，餐厅长期使用最好换成餐厅专用账号。这只是提醒，不作为降级条件，不要因此改成转给老板。

## 4. 绑定操作技能

专员要读得到绑定的技能，必须先授权 Ornn 服务（`ornn-api`），否则 `skill_read` 会失败，老板的入座、离店、换桌等指令就只能靠 Role 硬撑。授权时：

- 授权列表同时包含 `api-google-workspace` 和 `ornn-api`（授权是整体替换，不要漏掉前者，也不要改掉它的访客级别）。
- `ornn-api` 的老板回合操作范围只放行只读接口（读出操作列表，`read_only` 为真的那些）。
- `ornn-api` 的访客级别设为 `read`。访客回合本来就读不到技能，不需要更高的级别。


用 `search_agent_skills` 搜 `restaurant-reservation-desk`，`preview_agent_skill` 确认是同名技能，再用 `set_agent_skills` 把它的最新版本绑到订位专员（目标是专员的 ID，不是 NyxBot）。

Role 模板里已经有转给 `restaurant-reservation-desk` 的那句话，不要再另加一遍。

不要为桌位操作另写技能。

## 5. 渠道

渠道绑到订位专员，见 SKILL.md 第六步。

## 6. 回读

- 列出专员：名称、Role 和模板只差店名和表格 ID、总字符数（不超过 2048）、授权里有 `api-google-workspace`、技能里有 `restaurant-reservation-desk` 最新版本。
- 读访客权限：`api-google-workspace` 的级别和第 3 节表格一致。
- 读操作范围（老板回合和访客回合各读一次）：只读 `api-google-workspace` 这一个服务，逐个对照第 3 节「操作范围」表，读写表格和日历事件的接口都要在。`ornn-api` 不要把整份操作列表展开（有 70 多条，结果会被截断），只看它没有放开全部操作、条数大于 0。
- 让老板对专员说一句「今天有哪些订位」：能正常回答说明专员读得到操作台技能；回答「缺少 Ornn 访问」就回到第 4 节补授权。
- 任何一项缺失，补上再交付。
