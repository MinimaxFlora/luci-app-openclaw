#!/bin/sh
# 微信插件升级检测契约 (controller action_wechat_check_upgrade → m_wechat_check_upgrade)。
#
# 背景: 旧实现用 `npx view @tencent-weixin/openclaw-weixin version` 查询最新版本,
# 但 view 是 npm 的子命令而非 npx 的, npx 会把 view 当作待执行包解析并失败;
# 错误被 2>/dev/null 吞掉后 latest_version 恒空, 前端又显示"已是最新"——
# 升级检测从未真正工作。本测试锁定: 用 npm 而非 npx; 查询失败必须显式报错。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
BACKEND="$REPO_ROOT/root/usr/libexec/rpcd/openclaw"
VIEW="$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/wechat.js"

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

[ -f "$BACKEND" ] || fail "missing $BACKEND"
[ -f "$VIEW" ] || fail "missing $VIEW"

BODY=$(awk '/^m_wechat_check_upgrade()/,/^}/' "$BACKEND")
[ -n "$BODY" ] || fail "cannot locate m_wechat_check_upgrade"

# ── 必须用 npm view, 不能用 npx view ──
printf '%s' "$BODY" | grep -Fq 'npm_bin' \
	|| fail "check_upgrade must resolve the npm binary (view is an npm subcommand, not npx)"
if printf '%s' "$BODY" | grep -E 'npx[a-z_]*_bin|npx.*view' | grep -qv '^[[:space:]]*--'; then
	fail "check_upgrade must not call 'npx view' — npx cannot run npm's view subcommand"
fi
printf '%s' "$BODY" | grep -Fq 'view @tencent-weixin/openclaw-weixin version' \
	|| fail "check_upgrade must query the wechat plugin version"

# ── 查询失败必须可诊断, 不能被 2>/dev/null 吞掉 ──
if printf '%s' "$BODY" | grep -F 'view @tencent-weixin/openclaw-weixin version 2>/dev/null' | grep -q .; then
	fail "check_upgrade must not discard stderr — a failed query would look like 'up to date'"
fi
printf '%s' "$BODY" | grep -Fq 'check_err' \
	|| fail "check_upgrade must retain the error output for diagnostics"

# ── 响应必须区分"已是最新"与"查不到" ──
printf '%s' "$BODY" | grep -Fq '无法查询最新版本 (请检查网络或 npm 源)' \
	|| fail "check_upgrade must report status=error when the version lookup fails"
printf '%s' "$BODY" | grep -Fq 'json_add_string "message"' \
	|| fail "check_upgrade must return a message explaining a failed lookup"

# ── 前端不得把查询失败显示成"已是最新版本" ──
# 正确顺序: has_upgrade -> 未安装 -> 查询失败 -> 已是最新
printf '%s' "$(cat "$VIEW")" | grep -Fq "d.status !== 'ok' || !d.latest_version" \
	|| fail "wechat.js must handle a failed version lookup before claiming 'up to date'"
printf '%s' "$(cat "$VIEW")" | grep -Fq 'Could not determine the latest version' \
	|| fail "wechat.js must surface an explicit 'cannot determine latest version' state"

echo "ok"
