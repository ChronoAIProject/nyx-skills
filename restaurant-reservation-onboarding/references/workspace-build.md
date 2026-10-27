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
- `updateSpreadsheetProperties`：时区和 locale，同菜品表。

### 4.2 桌位表（sheetId 1）

`sheets_update_values` 到 `'桌位表'!A1`：表头 `桌号, 区域, 座位数, 类型, 默认用时（分钟）, 说明`，然后按 `table-setup.md` 一桌一行。记下桌数 N，数据占第 2 行到第 N+1 行。

### 4.3 订位登记（sheetId 0）

`sheets_update_values` 到 `'订位登记'!A1`，两行：

表头：`日期, 时段, 桌号, 姓名, 电话, 人数, 桌型需求, 预计到店, 预计用时（分）, 预计离店, 实际到店, 实际离店, 订金, 来源, 状态, 备注, 录入人`

示例行：`2026-11-01, 晚市, {某个 4 人桌桌号}, 王先生（示例）, '9123 4567, 4, 4人桌, 18:00, 90, =ARRAYFORMULA(IF(LEN(H2:H)*LEN(I2:I), H2:H+I2:I/1440, )), 18:05, 19:20, 免收, 电话, 已完成, 示例行，正式使用时可删除内容（J 列公式请保留）, {老板名}`

电话前加英文单引号，保留开头的 0 和空格。J2 的数组公式负责整列预计离店。

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

这是订位专员唯一要读的小块。`sheets_update_values` 到 `'时段余量'!A1`：

```
日期 | =TODAY() |  | 改日期可查其他天
（空行）
桌型 | 库存（张） | 午市已订 | 午市剩余 | 晚市已订 | 晚市剩余
2人桌 | =COUNTIFS('桌位表'!$C:$C,2,'桌位表'!$D:$D,"大厅") | C4 公式 | =B4-C4 | E4 公式 | =B4-E4
4人桌 | 座位数 4 | … | … | … | …
6人桌 | 座位数 6 | … | … | … | …
8人桌 | 座位数 8 | … | … | … | …
包间 | =COUNTIF('桌位表'!$D:$D,"包间") | … | … | … | …
```

C4（午市已订）：
```
=COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"已确认")+COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"已到")+COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"用餐中")+COUNTIFS('订位登记'!$A:$A,$B$1,'订位登记'!$B:$B,C$3,'订位登记'!$G:$G,$A4,'订位登记'!$O:$O,"待确认")
```
E4 同上，把 `C$3` 换成 `E$3`（表头里的「午市」「晚市」必须和订位登记时段下拉的文字一致）。C4 到 F4 写好后用 `copyPaste` 复制到第 5 行至第 8 行。桌型名要和订位登记「桌型需求」下拉完全一致。晚市分两批的餐厅，把「晚市」拆成「晚市一批」「晚市二批」两组列，时段下拉也加这两项。

### 4.6 使用说明（sheetId 4）

一列文字，一行一条，内容照 SKILL.md 第一步 D 组的规矩加上：三个工作表的分工，订位登记每列怎么填，状态四步（已确认 → 已到 → 用餐中 → 已完成，另有未到、取消），撞单标红的含义，当日桌况颜色，每周看翻台率和平均用餐时长。A 列宽 900，自动换行。

### 4.7 格式、下拉、条件格式（一个 batch）

- 三个表头行：同菜品表的深蓝白字粗体，订位登记和当日桌况表头加 `wrapStrategy: WRAP`。
- 订位登记数字格式：A 列 `DATE` `yyyy-mm-dd`；H、J、K、L 列 `TIME` `HH:mm`；E 列 `TEXT`。范围从第 2 行到第 1000 行。
- 当日桌况：B1 `DATE`，B2 `TIME` `HH:mm`，J、K 列 `TIME`；B1、B3 字体蓝色（输入）；I 到 K 列字体灰色并 `addDimensionGroup` 折叠。
- `setDataValidation`（都在订位登记第 2 到 1000 行，`showCustomUi: true`）：
  - B 时段 `ONE_OF_LIST`：午市、晚市（分批的餐厅按 4.5 改）。
  - C 桌号 `ONE_OF_RANGE`：`='桌位表'!$A$2:$A${N+1}`。
  - G 桌型需求 `ONE_OF_LIST`：2人桌、4人桌、6人桌、8人桌、包间（按实际桌型增减，没有包间就去掉）。
  - I 预计用时 `ONE_OF_LIST`：60、90、120、150、180。
  - M 订金 `ONE_OF_LIST`：未收、已收、免收。
  - N 来源 `ONE_OF_LIST`：电话、WhatsApp、到店、Google 表单、Chope（按老板的渠道改）。
  - O 状态 `ONE_OF_LIST`，`strict: true`：待确认、已确认、已到、用餐中、已完成、未到、取消。「待确认」只在老板要求某类订位先过目时用，算作已占位。
- `addConditionalFormatRule`（订位登记 A2 到 Q1000，`CUSTOM_FORMULA`）：
  - 撞单标红：`=AND($C2<>"",$H2<>"",COUNTIFS($A:$A,$A2,$C:$C,$C2,$H:$H,"<"&$J2,$J:$J,">"&$H2)>1)`，底色 (0.96, 0.8, 0.8)。
  - 用餐中：`=$O2="用餐中"`，底色 (0.85, 0.94, 0.83)。
  - 未到或取消：`=OR($O2="未到",$O2="取消")`，字体灰 (0.6, 0.6, 0.6)。
- 当日桌况 D5 到 D{N+4}，`TEXT_EQ`：用餐中绿底 (0.72, 0.88, 0.7)，预留中黄底 (1, 0.9, 0.6)，可坐蓝底 (0.8, 0.89, 0.97)，都加粗。
- 列宽：订位登记默认 95，姓名 130，备注 260；桌位表 120，说明 240；当日桌况默认 110，桌号 170，状态 170，可否安排散客 220。

## 5. 包间预订日历

只在有包间时建。`calendar_create_calendar`：`summary` 为 `{店名} 包间预订`，`timeZone` 为老板时区，`location` 为餐厅地址，`description` 写事件标题格式「到店时间 姓名 人数 包间名」和每个包间的容纳人数。记下返回的日历 ID，写进餐厅信息文档的关联文件。

## 6. 核对清单

- `sheets_get_values` 读 `'菜品'!A1:F3` 和末尾三行，核对行数。
- 读 `'当日桌况'!A1:H8`：B2 显示的是老板当地时间（时区设对了），第 5 行起桌号来自桌位表，状态「可坐」。
- 读 `'订位登记'!A1:Q2`：J2 显示 19:30。
- 读 `'时段余量'!A3:F8`：库存列等于桌位表各桌型数量。
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
