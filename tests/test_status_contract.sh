#!/bin/sh
# 状态 API/UI 契约 (迁移自 Lua controller + status.htm → rpcd exec plugin + basic.js)。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
BACKEND="$REPO_ROOT/root/usr/libexec/rpcd/openclaw"
BASIC_VIEW="$REPO_ROOT/htdocs/luci-static/resources/view/openclaw/basic.js"
INIT_SCRIPT="$REPO_ROOT/root/etc/init.d/openclaw"

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

[ -f "$BACKEND" ] || fail "missing rpcd backend $BACKEND"
[ -f "$BASIC_VIEW" ] || fail "missing basic.js view"

# ── 状态检测必须透过 procd / ubus 观察 gateway 实例 ──
grep -Fq "ubus call service list" "$BACKEND" || fail "status API should inspect procd state via ubus"
grep -Fq "openclaw.instances.gateway" "$BACKEND" || fail "status API should inspect gateway instance state"
grep -Fq "gateway_failed" "$BACKEND" || fail "status API should report gateway failure state"
grep -Fq "gateway_exit_code" "$BACKEND" || fail "status API should expose recent gateway exit code"
grep -Fq "gateway_crash_loop" "$BACKEND" || fail "status API should expose procd crash-loop state"
grep -Fq "procd_pid_alive" "$BACKEND" || fail "status API should ignore stale procd pidfiles"
grep -Fq "pidfile_stale" "$BACKEND" || fail "status API should require current stale pidfile evidence for crash-loop"

grep -Fq 'enabled=$(uci -q get openclaw.main.enabled' "$INIT_SCRIPT" || fail "status_service should honor disabled service state"
grep -Fq "网关:     已禁用" "$INIT_SCRIPT" || fail "status_service should report disabled gateway before crash-loop"

# 禁止宽泛的 pgrep 兜底匹配 (会匹配到状态探测脚本自身)
if grep -Fq 'pgrep -f "openclaw.*gateway"' "$BACKEND" "$INIT_SCRIPT" || grep -Fq "pgrep -f 'openclaw.*gateway'" "$BACKEND" "$INIT_SCRIPT"; then
	fail "status checks must not use broad pgrep fallback that can match the status shell itself"
fi

# ── UI 区分“启动失败”与“启动中” ──
grep -Fq "启动失败" "$BASIC_VIEW" || fail "status panel should distinguish startup failure from startup in progress"
grep -Fq "gateway_failed" "$BASIC_VIEW" || fail "status panel should render gateway failure state"
grep -Fq "正在启动" "$BASIC_VIEW" || fail "status panel should render startup-in-progress state"
grep -Fq "已禁用" "$BASIC_VIEW" || fail "status panel should render disabled state"

grep -Fq "ubus call service list" "$INIT_SCRIPT" || fail "status_service should report procd state via ubus"
grep -Fq "crash-loop 抑制" "$INIT_SCRIPT" || fail "status_service should report procd crash-loop suppression"

# ── 升级事务状态必须随 status 输出 ──
grep -Fq 'json_add_string "phase"' "$BACKEND" || fail "status API should report upgrade transaction phase"
grep -Fq 'json_add_string "target_version"' "$BACKEND" || fail "status API should report upgrade transaction target_version"
grep -Fq 'json_add_boolean "backup_verified"' "$BACKEND" || fail "status API should report upgrade transaction backup_verified"
grep -Fq 'json_add_boolean "migration_started"' "$BACKEND" || fail "status API should report upgrade transaction migration_started"
grep -Fq 'json_add_string "rollback_mode"' "$BACKEND" || fail "status API should report upgrade transaction rollback_mode"
grep -Fq 'json_add_int "error_code"' "$BACKEND" || fail "status API should report upgrade transaction error_code"

echo "ok"
