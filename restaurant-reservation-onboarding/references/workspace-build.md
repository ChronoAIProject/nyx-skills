# 在 Google Workspace 里建文件

工具名以 NyxID 绑定的 `api-google-workspace` 服务为准（例如 `api-google-workspace__drive_create_file`）。下面只写字段，JSON 片段照抄后替换花括号。所有写操作都先建后填，建完回读。

两套坐标：`sheets_get_values` 和 `sheets_update_values` 用 A1 写法（`'订位登记'!A1`）；`sheets_batch_update_spreadsheet` 用数字 `sheetId` 和从 0 开始、末端不含的行列索引（第 2 行到第 36 行是 `startRowIndex: 1, endRowIndex: 36`）。颜色用 0 到 1 的 `red`、`green`、`blue`。

## 1. 文件夹

先查：`drive_list_files`，`q` 为 `mimeType = 'application/vnd.google-apps.folder' and title contains '{店名}' and trashed = false`，`fields` 为 `files(id,name)`。有结果就停下问老板。

建：`drive_create_file`，`name` 为 `{店名} 餐厅管理`，`mimeType` 为 `application/vnd.google-apps.folder`，`fields` 为 `id,name,webViewLink`。记下文件夹 ID。

## 2. 菜品表

建：`drive_create_file`，`name` 为 `{店名} 菜品表`，`mimeType` 为 `application/vnd.google-apps.spreadsheet`，`parents` 为 `["{文件夹 ID}"]`。新表第一个工作表的 `sheetId` 是 0。

填：`sheets_update_values`，`range` 为 `A1`，`valueInputOption` 为 `USER_ENTERED`，`body.values` 第一行是表头 `编号, 分类, 菜名, 规格 / 单位, 价格 (SGD), 备注`，之后一行一菜，编号和价格用数字，空值用 `""`。超过 300 行分段写。

格式（一个 `sheets_batch_update_spreadsheet`，`requests` 依次）：
- `updateSheetProperties`：`properties.sheetId` 0、`title` 为 `菜品`、`gridProperties.frozenRowCount` 1，`fields` 为 `title,gridProperties.frozenRowCount`。
- `updateSpreadsheetProperties`：`properties.timeZone` 为 `Asia/Singapore`、`locale` 为 `zh_CN`，`fields` 为 `timeZone,locale`。
- `repeatCell` 表头：范围第 1 行 A 到 F，`cell.userEnteredFormat` 为深蓝底（0.122, 0.22, 0.392）、白色粗体、居中，`fields` 为 `userEnteredFormat.backgroundColor,userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat.bold,userEnteredFormat.textFormat.foregroundColor`。
- `repeatCell` 价格列：第 2 行到末行的 E 列，`numberFormat` 为 `{"type":"NUMBER","pattern":"$#,##0.00"}`，`fields` 为 `userEnteredFormat.numberFormat`。
- `setBasicFilter`：`filter.range` 覆盖 A1 到 F 末行。
- `updateCells` 备注：`rows` 为 `[{"values":[{"note":"来源：…"}]}]`，`fields` 为 `note`，`start` 为 `{"sheetId":0,"rowIndex":0,"columnIndex":0}`。
- `updateDimensionProperties` 列宽：A、B 70，C 200，D 260，E 100，F 260（`range.dimension` 为 `COLUMNS`，`properties.pixelSize`，`fields` 为 `pixelSize`）。

## 3. 餐厅信息文档

建：`drive_create_file`，`name` 为 `{店名} 餐厅信息`，`mimeType` 为 `application/vnd.google-apps.document`，`parents` 为文件夹 ID。

读：`docs_get_document`，`fields` 为 `revisionId`。新文档正文从索引 1 开始。

写（一个 `docs_batch_update_document`，带 `writeControl.requiredRevisionId`）：
1. `insertText`：`location.index` 1，`text` 是整篇正文，段落之间用换行，不要以换行结尾。段落顺序：标题「{店名} 餐厅信息」；「基本信息」；店名、菜系、营业地址、联系电话、营业时间（午市和晚市）、常用语言、信息更新日期；「座位规划」；桌型库存一段，包间一段，总座位一段；「关联文件」；菜品表、订位登记表、包间预订日历、Drive 文件夹各一行。
2. 对标题段 `updateParagraphStyle`，`namedStyleType` 为 `TITLE`；对三个节名 `HEADING_1`；`fields` 为 `namedStyleType,keepWithNext`。段落范围按 UTF-16 长度累加：每段的 `endIndex` 是上一段 `endIndex` 加本段字数加 1（换行）。中文每字算 1。
3. 对关联文件四行 `updateTextStyle`，`textStyle.link.url` 为对应链接，范围不含换行，`fields` 为 `link`。

不写菜单上的其他门店电话、打包费、消费税说明、促销语。

## 4. 订位登记表

建：`drive_create_file`，`name` 为 `{店名} 订位登记表`，`mimeType` 为 spreadsheet，`parents` 为文件夹 ID。

### 4.1 结构（一个 batch）

- `updateSheetProperties`：sheetId 0 改名 `订位登记`，冻结 1 行。
- `addSheet`：`properties` 为 `{"sheetId":1,"title":"桌位表","gridProperties":{"frozenRowCount":1}}`。
- `addSheet`：sheetId 2，`当日桌况`，冻结 4 行。
- `addSheet`：sheetId 3，`时段余量`，冻结 3 行。
- `addSheet`：sheetId 4，`使用说明`。
- `addSheet`：sheetId 5，`餐厅设置`，冻结 1 行。
- `addSheet`：sheetId 6，`订位速查`，冻结 2 行。
- `updateSpreadsheetProperties`：时区和 locale，同菜品表。

### 4.2 桌位表（sheetId 1）

`sheets_update_values` 到 `'桌位表'!A1`：表头 `桌号, 区域, 最多人数, 类型, 默认用时（分钟）, 说明, 桌型, 最少人数, 特点标签`，然后按 `table-setup.md` 一桌一行。记下桌数 N，数据占第 2 行到第 N+1 行。

### 4.3 订位登记（sheetId 0）

`sheets_update_values` 到 `'订位登记'!A1`，两行：

表头：`日期, 时段, 桌号, 姓名, 电话, 人数, 桌型需求, 预计到店, 预计用时（分）, 预计离店, 实际到店, 实际离店, 订金, 来源, 状态, 备注, 录入人, 特殊要求, 场合`

示例行：`2026-11-01, 晚市, {某个 4 人桌桌号}, 王先生（示例）, '9123 4567, 4, 4人桌, 18:00, 90, =ARRAYFORMULA(IF(LEN(H2:H)*LEN(I2:I), H2:H+I2:I/1440, )), 18:05, 19:20, 免收, 电话, 已完成, 示例行，正式使用时可删除内容（J 列公式请保留）, {老板名}, 一位小朋友需要儿童椅, 生日`

电话前加英文单引号，保留开头的 0 和空格。J2 的数组公式负责整列预计离店。R、S 两列放在最后，前面 A 到 Q 的列位置不变；老板关掉的那项也照建，只是专员不问。

### 4.4 当日桌况（sheetId 2）

`sheets_update_values` 到 `'当日桌况'!A1`，五行：

```
看板日期        | =TODAY() |  | 改成其他日期可查看当天排桌
当前时间        | =NOW()   |  | 文件 › 设置 › 计算 中把重算改为「每分钟」
散客最短用餐（分钟） | 90   |  | 下一批到店距现在不足此分钟数时，显示「预留中」
桌号 | 区域 | 座位 | 状态 | 已坐分钟 | 下一批到店 | 下一批人数 | 可否安排散客 | 辅助：用餐中单数 | 辅助：下一批（时间值） | 辅助：入座（时间值）
第 5 行公式（见下）
```

第 5 行 A 到 K：

```
A5  ='桌位表'!A2
B5  =VLOOKUP($A5,'桌位表'!$A:$C,2,FALSE)
C5  =VLOOKUP($A5,'桌位表'!$A:$C,3,FALSE)
D5  =IF($I5>0,"用餐中",IF(AND($J5>0,($J5-MOD(NOW(),1))*1440<$B$3),"预留中","可坐"))
E5  =IF($I5>0,INT((MOD(NOW(),1)-$K5)*1440),"")
F5  =IF($J5>0,TEXT($J5,"HH:mm"),"无")
G5  =IF($J5>0,SUMIFS('订位登记'!$F:$F,'订位登记'!$A:$A,$B$1,'订位登记'!$C:$C,$A5,'订位登记'!$H:$H,$J5,'订位登记'!$O:$O,"已确认"),"")
H5  =IF($D5<>"可坐","否",IF($J5>0,"可坐，需在 "&TEXT($J5-TIME(0,15,0),"HH:mm")&" 前离店","可坐"))
I5  =COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$C:$C,$A5,'订位登记'!$K:$K,"<>",'订位登记'!$L:$L,"")
J5  =MINIFS('订位登记'!$H:$H,'订位登记'!$A:$A,$B$1,'订位登记'!$C:$C,$A5,'订位登记'!$O:$O,"已确认",'订位登记'!$H:$H,">"&MOD(NOW(),1))
K5  =MAXIFS('订位登记'!$K:$K,'订位登记'!$A:$A,$B$1,'订位登记'!$C:$C,$A5,'订位登记'!$L:$L,"")
```

然后在 batch 里用 `copyPaste` 把第 5 行复制到第 6 行至第 N+4 行：`source` 为 `{"sheetId":2,"startRowIndex":4,"endRowIndex":5,"startColumnIndex":0,"endColumnIndex":11}`，`destination` 为 `{"sheetId":2,"startRowIndex":5,"endRowIndex":{N+4},"startColumnIndex":0,"endColumnIndex":11}`，`pasteType` 为 `PASTE_FORMULA`。相对引用会自动下移。

### 4.5 时段余量（sheetId 3）

给老板看的余量表，B1 改日期可查其他天。专员不读也不改这张表，它读 4.9 的「订位速查」；这张表的 A 列桌型是「订位速查」的桌型来源。`sheets_update_values` 到 `'时段余量'!A1`：

```
日期 | =TODAY() |  | 改日期可查其他天
（空行）
桌型 | 库存（张） | 午市已订 | 午市剩余 | 晚市已订 | 晚市剩余
2人桌 | =COUNTIF('桌位表'!$G:$G,$A4) | C4 公式 | =B4-C4 | E4 公式 | =B4-E4
4人桌 | 同上公式 | … | … | … | …
6人桌 | 同上公式 | … | … | … | …
8人桌 | 同上公式 | … | … | … | …
小包间 | 同上公式 | … | … | … | …
大包间 | 同上公式 | … | … | … | …
```

A 列每行一个桌型，取桌位表 G 列里出现的全部桌型，顺序从小到大，包间放最后；行数随餐厅实际桌型增减，记为 T。再在 H3 写「人数区间」，H4 写 `=MINIFS('桌位表'!$H:$H,'桌位表'!$G:$G,$A4)&"–"&MAXIFS('桌位表'!$C:$C,'桌位表'!$G:$G,$A4)`，让专员读余量时同时看到每种桌型能坐几人。

```
```

C4（午市已订）：
```
=COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"已确认")+COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"已到")+COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"用餐中")+COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"待确认")
```
E4 同上，把 `C$3` 换成 `E$3`（表头里的「午市」「晚市」必须和订位登记时段下拉的文字一致）。再在 I3、J3 写「午市可用桌号」「晚市可用桌号」，I4 写下面的公式，J4 把其中的 `C$3` 换成 `E$3`：

```
=IFERROR(TEXTJOIN("、",TRUE,FILTER('桌位表'!$A$2:$A,'桌位表'!$G$2:$G=$A4,ISNA(MATCH('桌位表'!$A$2:$A,FILTER('订位登记'!$C$2:$C,'订位登记'!$A$2:$A=$B$1,'订位登记'!$B$2:$B=C$3,REGEXMATCH('订位登记'!$O$2:$O&"","^(待确认|已确认|已到|用餐中)$")),0)))),"无")
```

它列出这一桌型在 B1 那天该时段还没被占的桌号。B4 到 F4、H4 到 J4 写好后用 `copyPaste` 复制到第 5 行至第 T+3 行。桌型名要和订位登记「桌型需求」下拉完全一致。晚市分两批的餐厅，把「晚市」拆成「晚市一批」「晚市二批」两组列，时段下拉也加这两项。

### 4.6 使用说明（sheetId 4）

一列文字，一行一条，内容照 SKILL.md 第一步 D 组的规矩加上：六个工作表的分工（订位登记、桌位表、当日桌况、时段余量、餐厅设置、订位速查），改规矩只改「餐厅设置」B 列（改完下一单就生效，不用找专员），「订位速查」全是公式不要手改，订位登记每列怎么填，状态（待确认、已确认、已到、用餐中、已完成、未到、取消），撞单标红的含义，当日桌况颜色，桌位表特点标签怎么改，包间订位会同步到包间预订日历，老板日常对专员说的几句话，每周看翻台率和平均用餐时长。A 列宽 900，自动换行。

### 4.7 格式、下拉、条件格式（一个 batch）

- 四个表头行（订位登记第 1 行 A 到 S、桌位表第 1 行 A 到 I、当日桌况第 4 行 A 到 K、时段余量第 3 行 A 到 J）：同菜品表的深蓝白字粗体，订位登记和当日桌况表头加 `wrapStrategy: WRAP`。
- 订位登记数字格式：A 列 `DATE` `yyyy-mm-dd`；H、J、K、L 列 `TIME` `HH:mm`；E 列 `TEXT`。范围从第 2 行到第 1000 行。
- 当日桌况：B1 `DATE`，B2 `TIME` `HH:mm`，J、K 列 `TIME`；B1、B3 字体蓝色（输入）；I 到 K 列字体灰色并 `addDimensionGroup` 折叠。
- `setDataValidation`（都在订位登记第 2 到 1000 行，`showCustomUi: true`）：
  - B 时段 `ONE_OF_LIST`：午市、晚市（分批的餐厅按 4.5 改）。
  - C 桌号 `ONE_OF_RANGE`：`='桌位表'!$A$2:$A${N+1}`。
  - G 桌型需求 `ONE_OF_LIST`：和时段余量 A 列的桌型完全一致（例如 2人桌、4人桌、6人桌、8人桌、小包间、大包间）。写实际安排的桌型，不写顾客的原话。
  - I 预计用时 `ONE_OF_LIST`：60、90、120、150、180。
  - M 订金 `ONE_OF_LIST`：未收、已收、免收。
  - N 来源 `ONE_OF_LIST`：Telegram、WhatsApp、NyxID、电话、到店（按老板的渠道增减，专员写入的值必须在列表里）。
  - O 状态 `ONE_OF_LIST`，`strict: true`：待确认、已确认、已到、用餐中、已完成、未到、取消。「待确认」只在老板要求某类订位先过目时用，算作已占位。
- `addConditionalFormatRule`（订位登记 A2 到 S1000，`CUSTOM_FORMULA`）：
  - 撞单标红：`=AND($C2<>"",$H2<>"",COUNTIFS($A:$A,$A2,$C:$C,$C2,$H:$H,"<"&$J2,$J:$J,">"&$H2)>1)`，底色 (0.96, 0.8, 0.8)。
  - 用餐中：`=$O2="用餐中"`，底色 (0.85, 0.94, 0.83)。
  - 未到或取消：`=OR($O2="未到",$O2="取消")`，字体灰 (0.6, 0.6, 0.6)。
- 当日桌况 D5 到 D{N+4}，`TEXT_EQ`：用餐中绿底 (0.72, 0.88, 0.7)，预留中黄底 (1, 0.9, 0.6)，可坐蓝底 (0.8, 0.89, 0.97)，都加粗。
- 列宽：订位登记默认 95，姓名 130，备注 260，特殊要求 220，场合 110；桌位表 120，说明 240，桌型 100，最少人数 90，特点标签 160；时段余量 110，可用桌号两列各 260；当日桌况默认 110，桌号 170，状态 170，可否安排散客 220。

### 4.8 餐厅设置（sheetId 5）

店铺事实和规矩都在这里，专员每单读一次（经 4.9 的 B1）。老板以后改规矩只改 B 列。`sheets_update_values` 到 `'餐厅设置'!A1`，`valueInputOption` 用 `RAW`（营业时间里的「–」和数字不能被当成公式或日期）：

| A 设置项 | B 值 | C 值为空时的默认 | D 说明 |
|---|---|---|---|
| 店名 | {店名} | | |
| 地址 | {地址} | | |
| 电话 | {电话} | | |
| 时区 | {时区} | {时区} | |
| 休息日 | {D 组休息日，没有写「无」} | 无 | 写星期几，例如「周一」；多个用「、」隔开 |
| 午市 | {如 11:00–16:59} | | 到店时间在这个范围内算午市 |
| 晚市 | {如 17:00–23:00} | | 到店时间在这个范围内算晚市 |
| 用餐时限 | {不限时 或 限时} | 不限时 | 不限时：同一桌每个时段只接一批；限时：按默认用时翻台 |
| 默认用时 | {如 2–4人 90 分钟；6–8人 120 分钟；包间 150 分钟} | 同 B 列 | 写进订位登记 I 列 |
| 订金 | {不收 或 规则} | 不收 | 例如「包间每间 S$100」 |
| 问特殊要求 | {是/否} | 是 | 是 或 否 |
| 问场合 | {是/否} | 是 | 是 或 否 |
| 场合安排 | {如 生日：送一份长寿面；没有留空} | 无 | 例如「生日：送一份长寿面」 |
| 大包间给少人数 | {否 或 是：条件} | 否 | 否；或「是：最低消费 S$500」 |
| 待确认类别 | {无 或 类别} | 无 | 需要店主先过目的订位，例如「包间」「8人以上」；其余自动确认 |
| 包间日历ID | {第 5 节的日历 ID，没有包间留空} | | 空表示没有包间日历 |
| 菜品表ID | {菜品表 ID，或留空} | | 空表示不回答菜单问题 |

行的顺序照上表，第 5 节按行号把日历 ID 写进 B17；专员和 desk 技能按项目名找值，老板以后加行也不影响它们。午市、晚市按 D 组的营业时间换算成到店时间范围。全天连续营业的店也分两段（默认 17:00 为界），不要合成一段：不限时的店每张桌每个时段只接一批，合成一段就成了每天只能订一次。只有真正只开午市或只开晚市的店，另一行才写「不营业」。格式：表头深蓝白字粗体，A 列宽 130、B 列宽 420、C 列宽 260、D 列宽 360，B、D 列自动换行，B 列底色浅黄 (1, 0.97, 0.8) 表示可改，C 列字体灰色。

### 4.9 订位速查（sheetId 6）

专员唯一要读的地方：第 1 行把餐厅设置压成一格，第 3 行起每天一行、未来 60 天，每个时段一列，按桌型列出还空着的桌号和特点标签。专员一轮并行读 `A1:B1` 和那天的 `A{n}:D{n}`（n = 那天与今天相差天数 + 3），不用改任何单元格。

先用 `sheets_update_values`（`USER_ENTERED`）写第 1 到 3 行：

```
A1  设置
B1  =TEXTJOIN("；",TRUE,ARRAYFORMULA(IF('餐厅设置'!A2:A40="","",'餐厅设置'!A2:A40&"="&IF('餐厅设置'!B2:B40="",'餐厅设置'!C2:C40,'餐厅设置'!B2:B40))))
A2  日期    B2  星期    C2  午市可用桌号（桌号[特点]）    D2  晚市可用桌号（桌号[特点]）
A3  =TODAY()
B3  =TEXT(A3,"dddd")
```

C3（午市）：

```
=TEXTJOIN("；",TRUE,MAP(FILTER('时段余量'!$A$4:$A$20,'时段余量'!$A$4:$A$20<>""),LAMBDA(t,t&"（"&MINIFS('桌位表'!$H:$H,'桌位表'!$G:$G,t)&"–"&MAXIFS('桌位表'!$C:$C,'桌位表'!$G:$G,t)&"人）："&IFERROR(TEXTJOIN("、",TRUE,FILTER('桌位表'!$A$2:$A&IF('桌位表'!$I$2:$I<>"","["&'桌位表'!$I$2:$I&"]",""),'桌位表'!$G$2:$G=t,'桌位表'!$A$2:$A<>"",ISNA(MATCH('桌位表'!$A$2:$A,FILTER('订位登记'!$C$2:$C,'订位登记'!$A$2:$A=$A3,'订位登记'!$B$2:$B="午市",REGEXMATCH('订位登记'!$O$2:$O&"","^(待确认|已确认|已到|用餐中)$")),0)))),"满"))))
```

D3 把其中的 `"午市"` 换成 `"晚市"`。A4 写 `=A3+1`。然后一个 batch 两次 `copyPaste`（`PASTE_FORMULA`）：A4 复制到 A5:A62（`source` `{"sheetId":6,"startRowIndex":3,"endRowIndex":4,"startColumnIndex":0,"endColumnIndex":1}`，`destination` 的 `startRowIndex` 4、`endRowIndex` 62）；B3:D3 复制到 B4:D62（`source` 行 2 到 3、列 1 到 4，`destination` 行 3 到 62、列 1 到 4）。

结果一格的样子：`2人桌（1–2人）：A01[靠窗]、A02；4人桌（3–4人）：B01、B02[安静]；小包间（6–8人）：满`。桌型取「时段余量」A 列，顺序从小到大、包间最后；人数区间取桌位表 H、C 列。晚市分两批的店，D 列改成「晚市一批」，E 列加「晚市二批」，公式里的时段文字跟着换，Role 里的读取范围改成 `A{n}:E{n}`。

格式：A 列 `DATE` `yyyy-mm-dd`，表头第 2 行深蓝白字粗体，A 列宽 100、B 列宽 80、C、D 列宽 600 并自动换行；B1 字体灰色、不换行。

## 5. 包间预订日历

只在有包间时建。`calendar_create_calendar`：`summary` 为 `{店名} 包间预订`，`timeZone` 为老板时区，`location` 为餐厅地址，`description` 写事件标题格式「到店时间 姓名 人数 包间名」和每个包间的容纳人数。记下返回的日历 ID，写进 `'餐厅设置'!B17`（包间日历ID）和餐厅信息文档的关联文件。专员和 desk 技能都从设置里取这个 ID，Role 里不写。

## 6. 核对清单

- `sheets_get_values` 读 `'菜品'!A1:F3` 和末尾三行，核对行数。
- 读 `'当日桌况'!A1:H8`：B2 显示的是老板当地时间（时区设对了），第 5 行起桌号来自桌位表，状态「可坐」。
- 读 `'订位登记'!A1:S2`：J2 显示 19:30。
- 读 `'时段余量'!A3:J`：库存列等于桌位表各桌型数量，人数区间和桌位表一致，小包间和大包间分开两行，I、J 列列出全部桌号（新表没有订位）。B1 是 `=TODAY()`。
- 读 `'餐厅设置'!A1:D18`：17 项都在，B 列和第一步 D 组老板的回答一致，有包间时 B17 是日历 ID。
- 读 `'订位速查'!A1:D4`：B1 是一串「项=值」并以「；」分隔，值为空的项显示 C 列默认；A3 是今天，A4 是明天；C3、D3 每个桌型都有人数区间和全部桌号，标签在方括号里，没有「#NAME?」或「#ERROR!」。再读 `A62`，是今天加 59 天。
- `docs_get_document`（`fields` 为 `body.content.paragraph.paragraphStyle.namedStyleType,body.content.paragraph.elements.textRun.content`）：一个 TITLE，三个 HEADING_1。
- `calendar_list_calendars`：新日历在列表里。

## 7. 常见失败

| 现象 | 原因 | 处理 |
|---|---|---|
| `Unable to parse range` | 工作表名不对或还没建 | 先跑 4.1 的 batch，再写值 |
| 当日桌况时间和当地差几小时 | 没设时区 | 补 `updateSpreadsheetProperties` |
| 状态全是「可坐」但有人在用餐 | 实际到店没填，或散客没登记 | 使用说明里已写明，交付时提醒老板 |
| `ONE_OF_RANGE` 下拉为空 | 范围写成了 `A2:A` 没有结束行，或桌位表名字不同 | 用 `$A$2:$A${N+1}` |
| 一次写入被截断 | 行数太多 | 每次不超过 300 行分段写 |
| 餐厅设置里「11:00–16:59」变成小数或日期 | 用了 `USER_ENTERED` | 4.8 改用 `RAW` 重写 B 列 |
| 订位速查某天显示有空桌但其实订满了 | 订位登记 B 列时段文字和公式里的「午市」「晚市」不一致，或状态拼错 | 时段、状态都用下拉选，不要手打 |
| 订位速查整格「满」 | 桌位表 G 列桌型名和时段余量 A 列不一致 | 两边改成同一个名字 |
