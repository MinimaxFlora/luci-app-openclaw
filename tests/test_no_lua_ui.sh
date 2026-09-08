#!/bin/sh
# LuCI Lua/HTM 残留检查 (§38)。
#
# JS 迁移完成后, LuCI UI 层不得再存在 luasrc 目录、*.lua / *.htm,
# 也不得再引用旧 LuCI Lua 机制 (controller / cbi / template.render / luci.sys.exec)。
# root/ 下的 OpenWrt runtime (init.d / shell 脚本 / openclaw-env) 不属于 LuCI 层,
# 排除在检查之外; 若确实需要保留 Lua/HTM, 必须在此说明原因。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

# 1) luasrc/ 目录必须整体移除
if [ -d "$REPO_ROOT/luasrc" ]; then
	fail "luasrc/ still exists — LuCI Lua UI must be fully migrated"
fi

# 2) 仓库不应残留旧的 LuCI UI Lua/htm (htdocs 之外允许 runtime 脚本使用 sh)
if find "$REPO_ROOT" -type f \( -name "*.lua" -o -name "*.htm" \) \
	-not -path "*/.git/*" -not -path "*/docs/*" 2>/dev/null | grep -q .; then
	fail "stale *.lua / *.htm files remain outside docs/:"
	find "$REPO_ROOT" -type f \( -name "*.lua" -o -name "*.htm" \) -not -path "*/.git/*" -not -path "*/docs/*" 2>/dev/null | head -20
fi

# 3) 旧 LuCI Lua 机制引用必须清零
for pat in "luci.controller" "luci.model.cbi" "template.render" "luci.sys.exec" "luci.dispatcher.build_url"; do
	if grep -Rns "$pat" "$REPO_ROOT/htdocs" "$REPO_ROOT/root" 2>/dev/null | grep -qv "\.po:"; then
		fail "legacy LuCI Lua reference found: $pat"
	fi
done

# 4) 新 LuCI 层必须就位
for f in \
	"$REPO_ROOT/htdocs/luci-static/resources/openclaw/api.js" \
	"$REPO_ROOT/htdocs/luci-static/resources/openclaw/common.js" \
	"$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/basic.js" \
	"$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/console.js" \
	"$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/advanced.js" \
	"$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/wechat.js" \
	"$REPO_ROOT/root/usr/libexec/rpcd/openclaw" \
	"$REPO_ROOT/root/usr/share/luci/menu.d/luci-app-openclaw.json" \
	"$REPO_ROOT/root/usr/share/rpcd/acl.d/luci-app-openclaw.json"
do
	[ -f "$f" ] || fail "missing modern LuCI file: $f"
done

echo "ok"
