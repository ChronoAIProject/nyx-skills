#!/usr/bin/env python3
"""Build and verify a small-business Notion hub with NyxID's published Notion
operations (`nyxid mcp call {service}__notion_*`). Idempotent: existing pages
and databases with the same title under the parent are reused; nothing is
ever deleted or archived. A reused database with missing properties is
reported, not altered.

Commands (all print one JSON object on stdout; exit 1 on failure):

  hub     --service SLUG --parent PAGE_ID --modules queue,faq,reservations
          [--rules RULES.json]
  append  --service SLUG --page PAGE_ID --markdown FILE
  verify  --service SLUG --parent PAGE_ID
  call    TOOL --args JSON|@FILE      any published NyxID operation, e.g.
          api-firecrawl__scrape or tools-firecrawl__search; prints its result

RULES.json keys (all optional strings): business, timezone, queue_hours,
minutes_per_party, grace_minutes, reservation_notice, max_party,
booking_window, escalation_contact, sms_confirm_template, sms_call_template.
"""
import argparse
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

QUEUE = {
    "Name": {"title": {}},
    "Phone": {"phone_number": {}},
    "Party size": {"number": {"format": "number"}},
    "Queue no.": {"number": {"format": "number"}},
    "Status": {"select": {"options": [
        {"name": "Waiting", "color": "blue"}, {"name": "Called", "color": "yellow"},
        {"name": "Served", "color": "green"}, {"name": "No-show", "color": "red"},
        {"name": "Left", "color": "gray"}]}},
    "Service date": {"date": {}},
    "Joined at": {"date": {}},
    "Called at": {"date": {}},
    "Confirmation SMS": {"checkbox": {}},
    "Called SMS": {"checkbox": {}},
    "Source": {"select": {"options": [
        {"name": "Telegram", "color": "default"}, {"name": "Walk-in", "color": "default"},
        {"name": "Other", "color": "default"}]}},
    "Notes": {"rich_text": {}},
}

RESERVATIONS = {
    "Name": {"title": {}},
    "Phone": {"phone_number": {}},
    "Party size": {"number": {"format": "number"}},
    "Dining at": {"date": {}},
    "Status": {"select": {"options": [
        {"name": "Pending", "color": "yellow"}, {"name": "Confirmed", "color": "green"},
        {"name": "Declined", "color": "red"}, {"name": "Cancelled", "color": "gray"},
        {"name": "Seated", "color": "blue"}, {"name": "No-show", "color": "red"}]}},
    "Requests": {"rich_text": {}},
    "Received at": {"date": {}},
    "Decided at": {"date": {}},
    "Source": {"select": {"options": [
        {"name": "Telegram", "color": "default"}, {"name": "Phone", "color": "default"},
        {"name": "Walk-in", "color": "default"}, {"name": "Other", "color": "default"}]}},
    "Call reference": {"rich_text": {}},
    "Notes": {"rich_text": {}},
}

FAQ_HEADINGS = ["Hours", "Location and contact", "Menu", "Dietary", "Reservations", "Queue",
                "Payment", "Parking and access", "Other questions", "Sources",
                "Open questions for owner"]


class NotionError(Exception):
    pass


class McpHttp:
    """Minimal MCP Streamable HTTP client for NyxID's /mcp endpoint, used when
    the installed CLI has no `nyxid mcp call`. Credentials are found the same
    way the CLI finds them; nothing is printed or stored."""

    VERSION = "2025-06-18"

    def __init__(self):
        subprocess.run(["nyxid", "session", "refresh"], capture_output=True)
        home = pathlib.Path.home() / ".nyxid"
        self.token = (os.environ.get("NYXID_ACCESS_TOKEN") or os.environ.get("NYXID_API_KEY")
                      or self._read(home / "access_token"))
        base = os.environ.get("NYXID_URL") or self._read(home / "base_url") or ""
        self.base = base.rstrip("/")
        if not self.token or not self.base:
            raise NotionError("no NyxID credential or base URL found for MCP")
        self.session = None
        self.next_id = 1

    @staticmethod
    def _read(path):
        try:
            return path.read_text().strip()
        except OSError:
            return None

    def _post(self, payload, notification=False):
        req = urllib.request.Request(self.base + "/mcp", data=json.dumps(payload).encode(), method="POST")
        req.add_header("Authorization", f"Bearer {self.token}")
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json, text/event-stream")
        req.add_header("User-Agent", "nyxid-business-setup-worker")
        if self.session:
            req.add_header("Mcp-Session-Id", self.session)
            req.add_header("MCP-Protocol-Version", self.VERSION)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                if payload.get("method") == "initialize":
                    self.session = resp.headers.get("Mcp-Session-Id")
                raw = resp.read().decode("utf-8", "replace")
                ctype = resp.headers.get("Content-Type", "")
        except urllib.error.HTTPError as err:
            raise NotionError(f"MCP HTTP {err.code}: {err.read().decode('utf-8', 'replace')[:600]}")
        if notification or not raw.strip():
            return {}
        if "text/event-stream" in ctype:
            msgs = [json.loads(line[5:]) for line in raw.splitlines() if line.startswith("data:")]
            msgs = [m for m in msgs if m.get("id") == payload.get("id")] or msgs
            return msgs[-1] if msgs else {}
        return json.loads(raw)

    def _rpc(self, method, params):
        payload = {"jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params}
        self.next_id += 1
        reply = self._post(payload)
        if "error" in reply:
            raise NotionError(f"MCP {method}: {json.dumps(reply['error'])[:600]}")
        return reply.get("result", {})

    def call_tool(self, name, args):
        if not self.session:
            self._rpc("initialize", {"protocolVersion": self.VERSION, "capabilities": {},
                                     "clientInfo": {"name": "nyxid-business-setup-worker", "version": "2"}})
            self._post({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
                       notification=True)
        # The universal dispatcher activates the service in this session and
        # applies the same authorization gates as a direct tool call.
        return self._rpc("tools/call", {"name": "nyx__call_tool", "arguments": {
            "tool_name": name, "arguments_json": json.dumps(args)}})


class Notion:
    """Calls NyxID MCP operations named {service}__{operation}: through
    `nyxid mcp call` when the CLI has it, otherwise through McpHttp."""

    def __init__(self, service, cli="nyxid"):
        self.service = service
        self.cli = cli
        # `nyxid mcp call` needs a human session and a recent CLI; agent keys
        # (CMA sandboxes) and older CLIs use the HTTP client instead.
        probe = subprocess.run([cli, "mcp", "call", "--help"], capture_output=True, text=True)
        human = not os.environ.get("NYXID_API_KEY") and not os.environ.get("NYXID_ACCESS_TOKEN")
        self.http = None if probe.returncode == 0 and human else McpHttp()

    def call(self, operation, args):
        if self.http:
            envelope = self.http.call_tool(f"{self.service}__{operation}", args)
            return self._unwrap(operation, envelope, 0, "")
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump(args, fh)
            path = fh.name
        try:
            res = subprocess.run([self.cli, "mcp", "call", f"{self.service}__{operation}",
                                  "--args", f"@{path}", "--output", "json"],
                                 capture_output=True, text=True)
        finally:
            os.unlink(path)
        out = (res.stdout or "").strip()
        try:
            envelope = json.loads(out) if out else {}
        except json.JSONDecodeError:
            raise NotionError(f"{operation}: non-JSON output (exit {res.returncode}): "
                              f"{out[:800]} {res.stderr[:800]}")
        return self._unwrap(operation, envelope, res.returncode, res.stderr)

    @staticmethod
    def _unwrap(operation, envelope, returncode, stderr):
        texts = [c.get("text", "") for c in envelope.get("content", []) if isinstance(c, dict)]
        body = "".join(texts)
        if returncode != 0 or envelope.get("isError"):
            raise NotionError(f"{operation}: exit {returncode}: {body[:1200]} {stderr[:600]}")
        try:
            data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            raise NotionError(f"{operation}: unexpected result: {body[:800]}")
        if isinstance(data, dict) and data.get("object") == "error":
            raise NotionError(f"{operation}: {json.dumps(data)[:1200]}")
        return data

    def children(self, block_id):
        rows, cursor = [], None
        while True:
            args = {"block_id": block_id, "page_size": 100}
            if cursor:
                args["start_cursor"] = cursor
            data = self.call("notion_list_block_children", args)
            rows += data.get("results", [])
            if not data.get("has_more"):
                return rows
            cursor = data.get("next_cursor")


def text(content):
    chunks = [content[i:i + 1900] for i in range(0, len(content), 1900)] or [""]
    return [{"type": "text", "text": {"content": c}} for c in chunks]


def md_blocks(markdown):
    blocks = []
    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        for prefix, kind in (("### ", "heading_3"), ("## ", "heading_2"), ("# ", "heading_1"),
                             ("- ", "bulleted_list_item"), ("* ", "bulleted_list_item")):
            if line.lstrip().startswith(prefix):
                blocks.append({"object": "block", "type": kind,
                               kind: {"rich_text": text(line.lstrip()[len(prefix):])}})
                break
        else:
            blocks.append({"object": "block", "type": "paragraph",
                           "paragraph": {"rich_text": text(line)}})
    return blocks


def append(notion, page_id, blocks):
    written = 0
    for i in range(0, len(blocks), 90):
        notion.call("notion_append_block_children", {"block_id": page_id, "children": blocks[i:i + 90]})
        written += len(blocks[i:i + 90])
    return written


def existing(notion, parent):
    pages, dbs = {}, {}
    for b in notion.children(parent):
        if b.get("type") == "child_page":
            pages.setdefault(b["child_page"].get("title", ""), b["id"])
        elif b.get("type") == "child_database":
            dbs.setdefault(b["child_database"].get("title", ""), b["id"])
    return pages, dbs


def ensure_page(notion, parent, title, pages, initial_markdown):
    if title in pages:
        return pages[title], True
    blocks = md_blocks(initial_markdown)
    page = notion.call("notion_create_page", {
        "parent": {"page_id": parent},
        "properties": {"title": {"title": text(title)}},
        "children": blocks[:90],
    })
    append(notion, page["id"], blocks[90:])
    return page["id"], False


def schema_diff(actual, expected):
    problems = []
    for name, spec in expected.items():
        kind = next(iter(spec))
        got = actual.get(name)
        if got is None:
            problems.append(f"missing:{name}")
        elif got.get("type") != kind:
            problems.append(f"type:{name}:{got.get('type')}!={kind}")
        elif kind == "select":
            want = {o["name"] for o in spec["select"]["options"]}
            have = {o.get("name") for o in got.get("select", {}).get("options", [])}
            if want - have:
                problems.append(f"options:{name}:missing {sorted(want - have)}")
    return problems


def ensure_db(notion, parent, title, schema, dbs):
    reused = title in dbs
    if not reused:
        db = notion.call("notion_create_database", {
            "parent": {"page_id": parent},
            "title": text(title),
            "properties": schema,
        })
        db_id = db["id"]
    else:
        db_id = dbs[title]
    actual = notion.call("notion_retrieve_database", {"database_id": db_id}).get("properties", {})
    return db_id, reused, schema_diff(actual, schema)


def rules_markdown(rules, modules):
    r = rules.get
    lines = [f"Bot rules for {r('business', 'this business')}. Times are {r('timezone', 'local time')}.",
             "## Queue"]
    if "queue" in modules:
        lines += [f"- Queue open: {r('queue_hours', 'ask the owner')}",
                  f"- Minutes per party for estimates: {r('minutes_per_party', 'ask the owner')}",
                  f"- Called customers must arrive within {r('grace_minutes', '10')} minutes",
                  "- Estimates are not promises. Customers see only their own entry."]
    else:
        lines.append("- Queue not enabled.")
    lines.append("## Reservations")
    if "reservations" in modules:
        lines += [f"- Minimum notice: {r('reservation_notice', 'ask the owner')}",
                  f"- Maximum party size for bot requests: {r('max_party', 'ask the owner')}",
                  f"- Booking window: {r('booking_window', 'ask the owner')}",
                  "- Every request starts as Pending; only staff confirm."]
    else:
        lines.append("- Reservations not enabled.")
    lines += ["## SMS templates",
              f"- Confirmation: {r('sms_confirm_template', 'SMS disabled (chat-only).')}",
              f"- Call: {r('sms_call_template', 'SMS disabled (chat-only).')}",
              "## Escalation",
              f"- Unknown answers and staff requests: {r('escalation_contact', 'ask the owner')}"]
    return "\n".join(lines)


def cmd_hub(a):
    notion = Notion(a.service)
    modules = {m.strip() for m in a.modules.split(",") if m.strip()}
    rules = json.load(open(a.rules)) if a.rules else {}
    pages, dbs = existing(notion, a.parent)
    out = {"task": "notion-hub", "parent_page_id": a.parent, "reused": [], "problems": []}
    rid, reused = ensure_page(notion, a.parent, "Bot rules", pages, rules_markdown(rules, modules))
    out["rules_page_id"] = rid
    out["reused"] += ["Bot rules"] if reused else []
    out["faq_page_id"] = None
    if modules & {"faq", "queue", "reservations"}:
        fid, reused = ensure_page(notion, a.parent, "FAQ", pages,
                                  f"FAQ for {rules.get('business', 'this business')}. "
                                  "Each fact ends with (source, date). Filled by research and the owner.")
        out["faq_page_id"] = fid
        out["reused"] += ["FAQ"] if reused else []
    for module, title, schema, key in (("queue", "Queue", QUEUE, "queue_db_id"),
                                       ("reservations", "Reservations", RESERVATIONS, "reservations_db_id")):
        out[key] = None
        if module in modules:
            db_id, reused, problems = ensure_db(notion, a.parent, title, schema, dbs)
            out[key] = db_id
            out["reused"] += [title] if reused else []
            out["problems"] += [f"{title}:{p}" for p in problems]
    print(json.dumps(out))
    return 1 if out["problems"] else 0


def cmd_append(a):
    notion = Notion(a.service)
    blocks = md_blocks(open(a.markdown).read())
    written = append(notion, a.page, blocks)
    readback = len(notion.children(a.page))
    print(json.dumps({"task": "append", "page_id": a.page, "blocks_written": written,
                      "page_block_count": readback}))
    return 0


def cmd_verify(a):
    notion = Notion(a.service)
    pages, dbs = existing(notion, a.parent)
    out = {"pages": pages, "databases": {}}
    for title, schema in (("Queue", QUEUE), ("Reservations", RESERVATIONS)):
        if title in dbs:
            props = notion.call("notion_retrieve_database", {"database_id": dbs[title]}).get("properties", {})
            out["databases"][title] = {"id": dbs[title], "problems": schema_diff(props, schema)}
    print(json.dumps(out))
    return 0


def cmd_call(a):
    raw = open(a.args[1:]).read() if a.args.startswith("@") else a.args
    service, _, operation = a.tool.partition("__")
    result = Notion(service).call(operation, json.loads(raw))
    print(json.dumps(result)[:200000])
    return 0


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("call")
    c.add_argument("tool")
    c.add_argument("--args", required=True)
    for name in ("hub", "append", "verify"):
        s = sub.add_parser(name)
        s.add_argument("--service", required=True, help="instance slug, e.g. api-notion-3")
        if name in ("hub", "verify"):
            s.add_argument("--parent", required=True)
        if name == "hub":
            s.add_argument("--modules", required=True)
            s.add_argument("--rules")
        if name == "append":
            s.add_argument("--page", required=True)
            s.add_argument("--markdown", required=True)
    a = p.parse_args()
    try:
        return {"hub": cmd_hub, "append": cmd_append, "verify": cmd_verify, "call": cmd_call}[a.cmd](a)
    except NotionError as err:
        print(json.dumps({"task": a.cmd, "error": str(err)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
