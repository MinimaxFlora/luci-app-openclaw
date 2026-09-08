#!/bin/sh
# Local smoke tests for the rpcd exec plugin's pure helpers (host side, no OpenWrt).
# Usage: sh tests/test_rpcd_backend_helpers.sh   (from repo root)
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
PLUGIN="$REPO_ROOT/root/usr/libexec/rpcd/openclaw"
[ -f "$PLUGIN" ] || { echo "missing $PLUGIN" >&2; exit 1; }

fail() { echo "FAIL: $1" >&2; exit 1; }
ok() { echo "ok - $1"; }

# sandbox with stub uci (defaults only) so path resolution is deterministic
SANDBOX=$(mktemp -d)
trap 'rm -rf "$SANDBOX"' EXIT
mkdir -p "$SANDBOX/bin"
cat > "$SANDBOX/bin/uci" <<'EOF'
#!/bin/sh
# minimal stub: echo defaults for the keys the plugin reads
for arg in "$@"; do
	case "$arg" in
		openclaw.main.install_path) echo '/opt'; exit 0 ;;
		openclaw.main.enabled) echo '0'; exit 0 ;;
		openclaw.main.port) echo '18789'; exit 0 ;;
		openclaw.main.pty_port) echo '18793'; exit 0 ;;
		openclaw.main.token) exit 0 ;;
		openclaw.main.pty_token) exit 0 ;;
	esac
done
exit 0
EOF
chmod +x "$SANDBOX/bin/uci"

export OPENCLAW_RPCD_SOURCED=1
# capture python before sourcing (the plugin normalizes PATH for its own use)
PYBIN=$(command -v python 2>/dev/null || printf '')

# source the plugin as a library (jshn may be absent on the host — only pure helpers tested)
# shellcheck disable=SC1090
. "$PLUGIN"
# restore a host-usable PATH for the test tooling
export PATH="$SANDBOX/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# ---- list output is valid JSON with all methods ----
LIST_OUT=$(env -u OPENCLAW_RPCD_SOURCED "$PLUGIN" list)
printf '%s' "$LIST_OUT" | "$PYBIN" -c 'import json,sys; d=json.load(sys.stdin); assert "status" in d and "service_ctl" in d and "backup" in d and "devices_approve" in d and "wechat_login" in d, list(d)' \
	|| fail "list output not valid JSON / methods missing"
ok "list prints valid JSON method signatures"

# ---- path derivation (fallback branch, no oc_load_paths on host) ----
load_runtime_paths
[ "$oc_root" = "/opt/openclaw" ] || fail "oc_root=$oc_root"
[ "$oc_data" = "/opt/openclaw/data" ] || fail "oc_data=$oc_data"
[ "$oc_config_file" = "/opt/openclaw/data/.openclaw/openclaw.json" ] || fail "config_file=$oc_config_file"
ok "load_runtime_paths derives /opt layout"

# ---- version compare ----
[ "$(ver_cmp 2026.9.1 2026.9.1)" = "0" ] || fail "ver_cmp equal"
[ "$(ver_cmp 2026.10.1 2026.9.1)" = "1" ] || fail "ver_cmp greater"
[ "$(ver_cmp 2026.9.1 2026.10.1)" = "2" ] || fail "ver_cmp lesser"
[ "$(ver_cmp v2.2.0 2.2.0)" = "0" ] || fail "ver_cmp strips v"
is_newer_version "2026.9.1" "2026.3.22" || fail "is_newer_version true case"
is_newer_version "2026.9.1" "2026.9.2" && fail "is_newer_version false case"
is_newer_version "" "2026.9.1" && fail "is_newer_version empty latest"
ok "version compare helpers"

# ---- format_size ----
[ "$(format_size 500)" = "500 B" ] || fail "format_size B"
[ "$(format_size 2048)" = "2.0 KB" ] || fail "format_size KB got $(format_size 2048)"
[ "$(format_size 5242880)" = "5.0 MB" ] || fail "format_size MB"
ok "format_size"

# ---- read_upgrade_status parses the transaction state file ----
mkdir -p "$SANDBOX/.luci-openclaw-upgrade"
cat > "$SANDBOX/.luci-openclaw-upgrade/status.json" <<'EOF'
{"phase":"migrating","target_version":"2026.10.1","backup_verified":true,"migration_started":true,"rollback_mode":"auto","error_code":0}
EOF
oc_root="$SANDBOX"
oc_data="$SANDBOX/data"
read_upgrade_status
[ "$up_phase" = "migrating" ] || fail "phase=$up_phase"
[ "$up_target" = "2026.10.1" ] || fail "target=$up_target"
[ "$up_backup" = "1" ] || fail "backup_verified not parsed"
[ "$up_migrated" = "1" ] || fail "migration_started not parsed"
[ "$up_rollback" = "auto" ] || fail "rollback_mode=$up_rollback"
[ "$up_error" = "0" ] || fail "error_code=$up_error"
ok "read_upgrade_status parses transaction JSON"

# ---- wechat plugin dir discovery ----
mkdir -p "$SANDBOX/data/.openclaw/extensions/openclaw-weixin"
echo '{"name":"x","version":"2.4.8"}' > "$SANDBOX/data/.openclaw/extensions/openclaw-weixin/openclaw.plugin.json"
oc_data="$SANDBOX/data"
D=$(find_wechat_plugin_dir) || fail "find_wechat_plugin_dir returned nothing"
[ "$D" = "$SANDBOX/data/.openclaw/extensions/openclaw-weixin" ] || fail "dir=$D"
ok "find_wechat_plugin_dir"

# ---- account-token extraction shape used by m_wechat_status ----
mkdir -p "$SANDBOX/data/.openclaw/openclaw-weixin"
cat > "$SANDBOX/data/.openclaw/openclaw-weixin/accounts.json" <<'EOF'
{"accounts":[{"wxid":"wxid_a","nickname":"张三"}]}
EOF
TOKENS=$(grep -o '"[^"]*"' "$SANDBOX/data/.openclaw/openclaw-weixin/accounts.json" | tr -d '"')
printf '%s' "$TOKENS" | grep -q "wxid_a" || fail "token extraction missed account value"
ok "wechat account token extraction"

# ---- sq() shell quoting ----
Q=$(sq "a'b")
[ "$Q" = "'a'\\''b'" ] || fail "sq quoting got $Q"
ok "sq() shell quoting"

echo "ALL OK"
