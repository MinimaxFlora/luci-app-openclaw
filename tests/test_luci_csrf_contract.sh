#!/bin/sh
# LuCI 状态变更端点安全契约 (post()/CSRF 时代的护栏在 JS 迁移后的等价物)。
#
# 背景: 旧实现把所有“会改状态/返回凭据”的 controller 端点注册为 post()
# (LuCI test_post_security: POST + 匹配会话的 CSRF token), 只读端点 call()。
#
# 新架构: UI 不再有 HTTP 端点 —— 全部调用经 LuCI /admin/ubus (JSON-RPC,
# 会话 + token, 无 GET 副作用) 打到 rpcd exec 插件 "openclaw"。因此安全
# 契约等价转化为:
#   1. 全部后端方法只能经 ubus 调用: htdocs 不得出现 XHR/裸端点字符串,
#      也不得残留旧 Lua controller 路径。
#   2. ACL 文件按读写拆分: 状态变更 / 返回凭据的方法只出现在 write 组;
#      只读方法在 read 组。任何方法都不得缺失于 ACL。
#   3. 视图层唯一调用通道是 openclaw/api.js 的 rpc.declare 封装。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
# Windows 宿主下给原生 python 用的路径 (MSYS /d/... 形式 python 打不开)
REPO_WIN=$(cd "$REPO_ROOT" && pwd -W 2>/dev/null || printf '%s' "$REPO_ROOT")
ACL="$REPO_ROOT/root/usr/share/rpcd/acl.d/luci-app-openclaw.json"
API="$REPO_ROOT/htdocs/luci-static/resources/openclaw/api.js"
BACKEND="$REPO_ROOT/root/usr/libexec/rpcd/openclaw"
VIEWS="$REPO_ROOT/htdocs/luci-static/resources/view/openclaw"

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

for f in "$ACL" "$API" "$BACKEND"; do
	[ -f "$f" ] || fail "missing $f"
done

# python3 优先, 其次 python (CI 的 ubuntu runner 自带 python3; Windows 商店
# 的 python3 占位符不是可用解释器, 因此用真实解释一次探测筛选)
PYBIN=""
for _cand in python3 python; do
	if command -v "$_cand" >/dev/null 2>&1 && "$_cand" -c 'import json' >/dev/null 2>&1; then
		PYBIN=$(command -v "$_cand")
		break
	fi
done
[ -n "$PYBIN" ] || fail "no working python interpreter for ACL JSON parsing"

# ── 1. 方法全集: backend 的 list 签名 与 api.js 声明 与 ACL 三者一致 ──
METHODS=$("$PYBIN" - "$REPO_WIN/root/usr/libexec/rpcd/openclaw" "$REPO_WIN/htdocs/luci-static/resources/openclaw/api.js" "$REPO_WIN/root/usr/share/rpcd/acl.d/luci-app-openclaw.json" <<'PYEOF'
import json, re, sys
backend, api, acl = sys.argv[1], sys.argv[2], sys.argv[3]

src = open(backend, encoding="utf-8").read()
m = re.search(r'^\{"status":\{.*\}$', src, re.M)
methods = set(re.findall(r'"([a-z_]+)":\{', m.group(0) if m else ''))

api_src = open(api, encoding="utf-8").read()
decl = re.findall(r"method: '([a-z_]+)'", api_src)
api_methods = set(decl)

acl_data = json.load(open(acl, encoding="utf-8"))
acl_obj = acl_data["luci-app-openclaw"]
read = set(acl_obj.get("read", {}).get("ubus", {}).get("openclaw", []))
write = set(acl_obj.get("write", {}).get("ubus", {}).get("openclaw", []))

issues = []
for meth in sorted(methods):
    if meth not in api_methods:
        issues.append("backend method %s missing from api.js" % meth)
    if meth not in read and meth not in write:
        issues.append("backend method %s missing from ACL" % meth)
for meth in sorted(api_methods):
    if meth not in methods:
        issues.append("api.js declares unknown method %s" % meth)
if issues:
    print("\n".join(issues))
    sys.exit(1)
print("ok")
PYEOF
)
[ "$METHODS" = "ok" ] || fail "method registry mismatch:
$METHODS"

# ── 2. 状态变更/凭据方法只能出现在 write 组 (ACL 语义拆分) ──
MUST_WRITE="service_ctl uninstall plugin_upgrade backup get_token
wechat_install wechat_login wechat_logout wechat_uninstall wechat_upgrade_plugin
devices_approve"
MUST_READ="status setup_log check_update plugin_upgrade_log check_system
wechat_status wechat_install_log wechat_login_status wechat_check_upgrade
devices_list"

check_acl() {
	_want="$1"  # read|write
	_meth="$2"
	"$PYBIN" - "$REPO_WIN/root/usr/share/rpcd/acl.d/luci-app-openclaw.json" "$_want" "$_meth" <<'PYEOF'
import json, sys
acl = json.load(open(sys.argv[1], encoding="utf-8"))
obj = acl["luci-app-openclaw"]
want = sys.argv[2]
meth = sys.argv[3]
grp = obj.get(want, {}).get("ubus", {}).get("openclaw", [])
sys.exit(0 if meth in grp else 1)
PYEOF
}

for m in $MUST_WRITE; do
	check_acl write "$m" || fail "method $m must be granted under ACL write (state change / credentials)"
	check_acl read "$m" && fail "method $m must NOT be granted under ACL read"
done
for m in $MUST_READ; do
	check_acl read "$m" || fail "method $m must be granted under ACL read"
	check_acl write "$m" && fail "method $m must NOT be granted under ACL write"
done

# ── 3. 前端必须零直接 HTTP/端点痕迹 ──
if grep -Rns "(new XHR())\|ocCsrfToken\|build_url\|status_api\|service_ctl?\|luci.controller\|luci.model.cbi\|template.render" "$VIEWS" "$REPO_ROOT/htdocs/luci-static/resources/openclaw" 2>/dev/null | grep -v "api.js" | grep -q .; then
	fail "views must not contain raw XHR / legacy endpoint / CSRF plumbing"
fi
if grep -Rq "luci.controller\|luci.model.cbi\|template.render" "$REPO_ROOT/htdocs" 2>/dev/null; then
	fail "htdocs must not reference legacy Lua LuCI machinery"
fi

# ── 4. LuCI Lua UI 层必须已删除 (controller/model/view 不再安装) ──
if [ -d "$REPO_ROOT/luasrc" ]; then
	fail "luasrc/ must be removed after the JS migration"
fi

echo "ok"
