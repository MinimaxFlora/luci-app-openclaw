#!/bin/sh
# 微信插件生命周期契约 (安装 / 登录 / 登出 / 卸载) — JS 迁移后锁定 backend。
#
# 背景 (实机验证发现):
# wechat uninstall 删除了插件与状态目录, 却不重启网关。网关进程仍在内存中
# 持有已加载的微信渠道, 会把会话游标写回刚被删除的
# .openclaw/openclaw-weixin/accounts/ 目录 —— 于是目录被重建, 卸载后仍残留
# 登录态。对比: login 成功后与 logout 都会重启/热载网关, 卸载不能漏。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
# Windows 宿主下给原生 python 用的路径 (MSYS /d/... 形式 python 打不开)
REPO_WIN=$(cd "$REPO_ROOT" && pwd -W 2>/dev/null || printf '%s' "$REPO_ROOT")
BACKEND="$REPO_ROOT/root/usr/libexec/rpcd/openclaw"
ACL="$REPO_ROOT/root/usr/share/rpcd/acl.d/luci-app-openclaw.json"

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

[ -f "$BACKEND" ] || fail "missing $BACKEND"
[ -f "$ACL" ] || fail "missing $ACL"

# 函数体提取: m_wechat_uninstall / m_wechat_logout 内部含 node -e 片段,
# 片段里有行首 '}' 的 JS 大括号, 用 awk '/^}/ 截断会提前结束 —— 因此按
# 后置边界 (下个方法定义 / 分区注释) 取区间。
UNINSTALL=$(sed -n '/^m_wechat_uninstall()/,/^# ===/p' "$BACKEND")
[ -n "$UNINSTALL" ] || fail "cannot locate m_wechat_uninstall"
LOGOUT=$(sed -n '/^m_wechat_logout()/,/^m_wechat_check_upgrade()/p' "$BACKEND")
[ -n "$LOGOUT" ] || fail "cannot locate m_wechat_logout"

# ── 卸载必须重启网关, 否则登录态会被写回 ──
printf '%s' "$UNINSTALL" | grep -Fq '/etc/init.d/openclaw restart' \
	|| fail "uninstall must restart the gateway — otherwise the still-loaded wechat channel rewrites its session state into the deleted directory"

# 重启后需再清理一次状态目录 (重启是异步的)
printf '%s' "$UNINSTALL" | grep -Fq 'wechat_state_dir' \
	|| fail "uninstall must remove the wechat state directory"
printf '%s' "$UNINSTALL" | grep -Eq 'sleep [0-9]+; *rm -rf' \
	|| fail "uninstall must re-clean the state dir after the async gateway restart"

# ── 登录成功路径 / 登出必须重载网关, 不得退化 ──
printf '%s' "$(cat "$BACKEND")" | grep -Fq 'restart_gateway' \
	|| fail "login success path must reload the gateway so the channel change takes effect"
printf '%s' "$LOGOUT" | grep -Eq '/etc/init.d/openclaw (restart|reload)|restart_gateway' \
	|| fail "logout must reload the gateway so the channel change takes effect"

# ── 卸载必须清理配置中的微信痕迹, 但不得动无关配置 ──
printf '%s' "$UNINSTALL" | grep -Fq "x !== 'openclaw-weixin' && x !== 'weixin'" \
	|| fail "uninstall must drop both the current and legacy wechat plugin ids from plugins.allow"
if printf '%s' "$UNINSTALL" | grep -Eq 'd\.channels *= *\{\}|d\.models *= *\{\}'; then
	fail "uninstall must not wipe unrelated channels or model config"
fi

# ── 生命周期端点必须走 ACL write 组 (等价取代 POST + CSRF) ──
PYBIN=""
for cand in python3 python; do
	if command -v "$cand" >/dev/null 2>&1 && "$cand" -c 'import json' >/dev/null 2>&1; then
		PYBIN=$(command -v "$cand")
		break
	fi
done
[ -n "$PYBIN" ] || fail "no working python interpreter for ACL parsing"
for ep in wechat_install wechat_uninstall wechat_login wechat_logout wechat_upgrade_plugin; do
	"$PYBIN" - "$REPO_WIN/root/usr/share/rpcd/acl.d/luci-app-openclaw.json" "$ep" <<'PYEOF' || fail "method $ep must be in ACL write group"
import json, sys
acl = json.load(open(sys.argv[1], encoding="utf-8"))["luci-app-openclaw"]
write = acl.get("write", {}).get("ubus", {}).get("openclaw", [])
sys.exit(0 if sys.argv[2] in write else 1)
PYEOF
done

# ── 换行符约束 (LF only) ──
cr=$(printf '\r')
if LC_ALL=C grep -q "$cr" "$BACKEND"; then
	fail "backend must use LF line endings"
fi

echo "ok"
