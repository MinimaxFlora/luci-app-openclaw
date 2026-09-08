#!/bin/sh
# OpenClaw 浏览器设备配对语义与安全契约测试。
#
# 背景 (OpenClaw 2026.9.1+):
# 上游安全策略要求首次连接 Control UI 时进行设备配对审批：
#   - 列出请求: openclaw devices list --json
#   - 批准请求: openclaw devices approve <requestId>
#
# 核心规范 (JS 迁移后指向 rpcd exec plugin 与 JS 视图):
#   1. 终端交互菜单 (oc-config-interactive.js) 与传统 Shell 菜单 (oc-config.sh)
#      必须提供设备配对管理与一键批准功能。
#   2. Web 控制台 (console.js) 与终端配置 (advanced.js) 必须提供一键批准设备
#      配对能力, 且必须显式标注安全风险提示。
#   3. backend (/usr/libexec/rpcd/openclaw) 的 devices_approve 走 ubus
#      (会话鉴权 + ACL write), 等价取代旧 post()+CSRF 防线。
#   4. 所有受影响文件必须保持 LF 换行。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
# Windows 宿主下给原生 python 用的路径 (MSYS /d/... 形式 python 打不开)
REPO_WIN=$(cd "$REPO_ROOT" && pwd -W 2>/dev/null || printf '%s' "$REPO_ROOT")
JS_CONFIG="$REPO_ROOT/root/usr/share/openclaw/oc-config-interactive.js"
SH_CONFIG="$REPO_ROOT/root/usr/share/openclaw/oc-config.sh"
BACKEND="$REPO_ROOT/root/usr/libexec/rpcd/openclaw"
CONSOLE="$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/console.js"
ADVANCED="$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/advanced.js"
ACL="$REPO_ROOT/root/usr/share/rpcd/acl.d/luci-app-openclaw.json"

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

for f in "$JS_CONFIG" "$SH_CONFIG" "$BACKEND" "$CONSOLE" "$ADVANCED" "$ACL"; do
	[ -f "$f" ] || fail "missing $f"
done

# ── 1. 终端菜单 CLI 调用契约 ──
grep -Fq "'devices', 'list'" "$JS_CONFIG" || fail "interactive config must use devices list"
grep -Fq "'devices', 'approve'" "$JS_CONFIG" || fail "interactive config must use devices approve"
grep -Fq "oc_cmd devices list" "$SH_CONFIG" || fail "shell config must use oc_cmd devices list"
grep -Fq "oc_cmd devices approve" "$SH_CONFIG" || fail "shell config must use oc_cmd devices approve"

# ── 2. 菜单项注册与可达性 ──
grep -Fq "value: 'devices'" "$JS_CONFIG" || fail "interactive config must expose devices menu item"
grep -Fq "manageDevicePairing" "$JS_CONFIG" || fail "interactive config must implement manageDevicePairing"
grep -Fq "devices_pairing_menu" "$SH_CONFIG" || fail "shell config must implement devices_pairing_menu"

# ── 3. backend 端点契约 ──
grep -Fq "devices list --json" "$BACKEND" || fail "backend must invoke devices list --json"
grep -Fq "devices approve" "$BACKEND" || fail "backend must invoke devices approve"
grep -Fq "fix_state_permissions" "$BACKEND" || fail "backend must fix permissions after approval"
grep -Fq "缺少 request_id 或 all 参数" "$BACKEND" || fail "backend must reject empty approve requests"
grep -Fq "No pending device" "$BACKEND" || fail "backend must treat 'No pending device' as a failure signal"
# 批准必须拿到 CLI 的真实退出码并据此判断 (旧 controller 用 __EXIT 标记, 现由 node/spawn 携带)
grep -Eq 'rc=\$[?]|oc_devices_cli_capture' "$BACKEND" || fail "backend must capture the CLI exit code"

# ── 4. Web 端安全风险提示契约 (4 处界面必须显著标注) ──
for f in "$JS_CONFIG" "$SH_CONFIG"; do
	grep -Fq "风险提示" "$f" || fail "$(basename "$f") missing risk warning heading"
	grep -Fq "完全控制权限" "$f" || fail "$(basename "$f") missing full control permission warning"
done
for f in "$CONSOLE" "$ADVANCED"; do
	grep -Fq "Risk notice" "$f" || fail "$(basename "$f") missing risk warning heading"
	grep -Fq "full control over the OpenClaw gateway" "$f" || fail "$(basename "$f") missing full control permission warning"
done

# ── 5. 前端 ubus 调用契约 ──
for f in "$CONSOLE" "$ADVANCED"; do
	grep -Fq "devicesApprove(" "$f" || fail "$(basename "$f") missing devices approve call"
	grep -Fq "devicesList(" "$f" || fail "$(basename "$f") missing devices list call"
done

# ── 6. XSS 防护契约 (转义助手集中在 openclaw/common.js, 两个视图必须使用) ──
COMMON="$REPO_ROOT/htdocs/luci-static/resources/openclaw/common.js"
grep -Fq "escapeHtml = function" "$COMMON" || fail "common.js must define escapeHtml"
for f in "$CONSOLE" "$ADVANCED"; do
	grep -Fq "escapeHtml(item.remoteIp" "$f" || fail "$(basename "$f") must escape remoteIp"
	grep -Fq "escapeHtml(item.clientId" "$f" || fail "$(basename "$f") must escape clientId"
	grep -Fq "escapeHtml(item.requestId" "$f" || fail "$(basename "$f") must escape requestId"
done

# ── 7. devices_approve 必须经 ACL write 组 (等价的 CSRF 防线) ──
PYBIN=""
for _cand in python3 python; do
	if command -v "$_cand" >/dev/null 2>&1 && "$_cand" -c 'import json' >/dev/null 2>&1; then
		PYBIN=$(command -v "$_cand")
		break
	fi
done
if [ -n "$PYBIN" ]; then
	"$PYBIN" - "$REPO_WIN/root/usr/share/rpcd/acl.d/luci-app-openclaw.json" <<'PYEOF' || fail "devices_approve must be granted under ACL write, devices_list under read"
import json, sys
acl = json.load(open(sys.argv[1], encoding="utf-8"))["luci-app-openclaw"]
write = acl.get("write", {}).get("ubus", {}).get("openclaw", [])
read = acl.get("read", {}).get("ubus", {}).get("openclaw", [])
assert "devices_approve" in write and "devices_approve" not in read, "devices_approve ACL split"
assert "devices_list" in read and "devices_list" not in write, "devices_list ACL split"
PYEOF
fi

# ── 8. 换行符约束 (LF only) ──
cr=$(printf '\r')
for f in "$JS_CONFIG" "$SH_CONFIG" "$BACKEND" "$CONSOLE" "$ADVANCED"; do
	if LC_ALL=C grep -q "$cr" "$f"; then
		fail "$(basename "$f") must use LF line endings"
	fi
done

echo "ok"
