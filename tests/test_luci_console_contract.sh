#!/bin/sh
# Web 控制台 UI 契约 (console.htm → htdocs view/openclaw/console.js)。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
CONSOLE_VIEW="$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/console.js"

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

[ -f "$CONSOLE_VIEW" ] || fail "missing $CONSOLE_VIEW"

# 网关 URL 必须强制 HTTP (OpenClaw Control UI 是纯 HTTP 服务)
grep -Fq "'http://' + host + ':'" "$CONSOLE_VIEW" || fail "console view should force HTTP gateway URL"
if grep -Eq "'https?://' \+ location\.protocol|location\.protocol.*getConsoleUrl" "$CONSOLE_VIEW"; then
	fail "console view must not derive the gateway scheme from the LuCI page protocol"
fi

# 内嵌 iframe 细节必须保留
grep -Fq "document.createElement('iframe')" "$CONSOLE_VIEW" || fail "console view should embed the OpenClaw UI in an iframe"
grep -Fq "oc-console-iframe" "$CONSOLE_VIEW" || fail "console view should define oc-console-iframe"
grep -Fq "allowfullscreen" "$CONSOLE_VIEW" || fail "console view should support fullscreen"
grep -Fq "microphone" "$CONSOLE_VIEW" || fail "console view should allow media permissions"

# 换行符约束 (LF only)
cr=$(printf '\r')
if LC_ALL=C grep -q "$cr" "$CONSOLE_VIEW"; then
	fail "console view should use LF line endings"
fi

echo "ok"
