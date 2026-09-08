#!/bin/sh
# 打包清单一致性契约。
#
# 背景: 本项目有三条打包路径，各自独立维护安装清单:
#   1. Makefile              — feeds / OpenWrt SDK 编译 (逐个 INSTALL_* 枚举)
#   2. scripts/build_ipk.sh  — 本地 .ipk 构建 (大量使用 cp *.js / *.sh 通配)
#   3. scripts/build_run.sh  — .run 自解压包构建 (同上)
#
# 实测漂移: Makefile 只安装 oc-config.sh + web-pty.js，漏掉
# oc-config-interactive.js 与 oc-menu-engine.js。Release 的 .ipk/.run 正常，
# 但走 feeds/SDK 编译装出来的包缺这两个文件，此时 oc-config.sh 的
# can_use_interactive() 因 [ -f "$OC_INTERACTIVE" ] 失败而静默回落到传统菜单
# —— 用户看不到任何报错，只会觉得界面和教程不一致。
#
# 本测试对每个应打包的源文件，校验三条路径都会安装它。
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
MK="$REPO_ROOT/Makefile"
IPK="$REPO_ROOT/scripts/build_ipk.sh"
RUN="$REPO_ROOT/scripts/build_run.sh"

fail() {
	echo "FAIL: $1" >&2
	exit 1
}

for f in "$MK" "$IPK" "$RUN"; do
	[ -f "$f" ] || fail "missing $f"
done

# 判断某条打包脚本是否会安装指定源文件。
# 命中方式二选一:
#   - 显式提到文件名
#   - 存在覆盖其目录 + 扩展名的通配 (如 root/usr/share/openclaw/"*.js)
covered() {
	_file="$1"   # 相对仓库根的路径, 如 root/usr/share/openclaw/oc-menu-engine.js
	_script="$2"

	# Makefile 走 luci.mk 自动打包 (与 mosdns/ota 同款):
	#   htdocs/* → /www, root/* → / (cp -pR), po/<lang>/*.po → luci-i18n 包
	# 因此只要源文件位于这些目录且 Makefile include 了 luci.mk 即视为覆盖。
	if [ "$_script" = "$MK" ]; then
		grep -Eq '^[[:space:]]*include[[:space:]].*feeds/luci/luci\.mk' "$MK" || return 1
		case "$_file" in
			root/*|htdocs/luci-static/resources/*|po/zh_Hans/*.po) return 0 ;;
		esac
		return 1
	fi

	_base=$(basename "$_file")
	_dir=$(dirname "$_file")
	_ext=$(printf '%s' "$_base" | sed -n 's/.*\.\([A-Za-z0-9]\+\)$/\1/p')

	# 显式文件名
	if grep -Fq "$_base" "$_script"; then
		return 0
	fi
	# 目录通配: 匹配形如 <dir>/"*.ext 或 <dir>/*.ext
	if [ -n "$_ext" ] && grep -Fq "${_dir}/" "$_script" && grep -Fq "*.${_ext}" "$_script"; then
		# 进一步确认同一行里既有该目录又有该扩展通配
		if grep -F "${_dir}/" "$_script" | grep -Fq "*.${_ext}"; then
			return 0
		fi
	fi
	return 1
}

# ── 应打包的源文件集合 ──
# 只列运行时必需的文件; tests/ 与 docs/ 由 .gitattributes export-ignore 排除。
FILES=""
add_files() {
	for p in "$@"; do
		[ -e "$REPO_ROOT/$p" ] || continue
		FILES="$FILES $p"
	done
}

add_files root/etc/config/openclaw
add_files root/etc/uci-defaults/99-openclaw
add_files root/etc/init.d/openclaw
add_files root/etc/profile.d/openclaw.sh
add_files root/usr/bin/openclaw-env
for f in "$REPO_ROOT"/root/usr/libexec/*.sh; do
	[ -f "$f" ] && add_files "root/usr/libexec/$(basename "$f")"
done
add_files root/usr/libexec/rpcd/openclaw
for f in "$REPO_ROOT"/htdocs/luci-static/resources/view/openclaw/*.js; do
	[ -f "$f" ] && add_files "htdocs/luci-static/resources/view/openclaw/$(basename "$f")"
done
for f in "$REPO_ROOT"/htdocs/luci-static/resources/openclaw/*.js; do
	[ -f "$f" ] && add_files "htdocs/luci-static/resources/openclaw/$(basename "$f")"
done
add_files root/usr/share/luci/menu.d/luci-app-openclaw.json
for f in "$REPO_ROOT"/root/usr/share/rpcd/acl.d/*.json; do
	[ -f "$f" ] && add_files "root/usr/share/rpcd/acl.d/$(basename "$f")"
done
# /usr/share/openclaw 下的脚本与前端 (ui/ 目录整体复制, 单独校验)
for f in "$REPO_ROOT"/root/usr/share/openclaw/*.sh "$REPO_ROOT"/root/usr/share/openclaw/*.js; do
	[ -f "$f" ] && add_files "root/usr/share/openclaw/$(basename "$f")"
done

[ -n "$FILES" ] || fail "no packageable source files detected (parser drift?)"

# ── 三条路径逐一校验 ──
missing=""
for rel in $FILES; do
	covered "$rel" "$MK"  || missing="${missing}\n  Makefile        缺少 $rel"
	covered "$rel" "$IPK" || missing="${missing}\n  build_ipk.sh    缺少 $rel"
	covered "$rel" "$RUN" || missing="${missing}\n  build_run.sh    缺少 $rel"
done

if [ -n "$missing" ]; then
	# shellcheck disable=SC2059
	printf "打包清单不一致:$missing\n" >&2
	fail "packaging paths disagree on which files to install"
fi

# ── ui/ 目录与 VERSION (luci.mk 模式下由 root/ 自动携带) ──
grep -Eq '^[[:space:]]*include[[:space:]].*feeds/luci/luci\.mk' "$MK" || fail "Makefile must use luci.mk (auto-installs ui/ and VERSION)"
[ -d "$REPO_ROOT/root/usr/share/openclaw/ui" ] || fail "missing source dir root/usr/share/openclaw/ui"
[ -f "$REPO_ROOT/VERSION" ] || fail "missing VERSION file"
for s in "$IPK" "$RUN"; do
	grep -Fq 'share/openclaw/ui' "$s" || fail "$(basename "$s") must install the Web PTY ui/ directory"
	grep -Fq 'VERSION' "$s" || fail "$(basename "$s") must ship the VERSION file"
done

# ── 回归钉子 ──
# 这两个文件曾只在 build 脚本里、Makefile 漏装; luci.mk 模式下 root/* 全自动,
# 源文件存在性 + covered("$MK") 已保证三条路径一致。
[ -f "$REPO_ROOT/root/usr/share/openclaw/oc-config-interactive.js" ] || fail "missing oc-config-interactive.js"
[ -f "$REPO_ROOT/root/usr/share/openclaw/oc-menu-engine.js" ] || fail "missing oc-menu-engine.js"

# 依赖声明三处必须一致, 且不得丢掉 libstdcpp6 (issue #28: 缺失导致 Node 无法运行)
for s in "$MK" "$IPK" "$RUN"; do
	grep -Fq 'libstdcpp6' "$s" || fail "$(basename "$s") must keep the libstdcpp6 dependency (issue #28)"
done

# feeds 集成: 走 luci.mk 全自动打包 (同 luci-app-mosdns / luci-app-ota),
# htdocs/root/po 由 luci.mk 安装, i18n 自动拆分为 luci-i18n-openclaw-zh-cn 包。
grep -Eq '^[[:space:]]*include[[:space:]].*feeds/luci/luci\.mk' "$MK" || fail "Makefile must include feeds/luci/luci.mk"
# 主包主体 (define Package/<name>) 由 luci.mk 生成; 不得再手写 install 覆盖自动安装
if grep -Eq '^define Package/\$\(PKG_NAME\)/install' "$MK"; then
	fail "Makefile must not hand-roll Package install (luci.mk auto-installs htdocs/ and root/)"
fi
# po/zh_Hans 必须存在 → luci.mk 自动生成 luci-i18n-openclaw-zh-cn
[ -f "$REPO_ROOT/po/zh_Hans/openclaw.po" ] || fail "missing po/zh_Hans/openclaw.po (luci.mk i18n source)"

# 新增的共享数据文件: build 脚本只 cp *.js 通配, .json 需显式; luci.mk 模式下 root/ 全自动
for s in "$IPK" "$RUN"; do
	grep -Fq 'model-presets.json' "$s" \
		|| fail "$(basename "$s") must install model-presets.json (the *.js glob does not cover it)"
done
[ -f "$REPO_ROOT/root/usr/share/openclaw/model-presets.json" ] \
	|| fail "missing root/usr/share/openclaw/model-presets.json (luci.mk auto-installs root/)"

# ── 真实构建产物校验 ──
# 前面的检查都是静态文本比对，抓不到"脚本已改但产物仍缺文件"的情况
# (例如同步失误)。这里实际构建一次 .ipk 并检查解包内容。
# 需要 ar/tar，缺失时跳过而不是误报。
if command -v ar >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
	BUILD_TMP=$(mktemp -d 2>/dev/null || echo "/tmp/oc-parity-build-$$")
	mkdir -p "$BUILD_TMP"
	cleanup_build() { rm -rf "$BUILD_TMP"; }
	trap cleanup_build EXIT

	if ( cd "$REPO_ROOT" && sh scripts/build_ipk.sh "$BUILD_TMP" ) >/dev/null 2>&1; then
		IPK_FILE=$(ls "$BUILD_TMP"/*.ipk 2>/dev/null | head -1)
		if [ -n "$IPK_FILE" ]; then
			EXTRACT="$BUILD_TMP/extract"
			mkdir -p "$EXTRACT"
			( cd "$EXTRACT" && { ar x "$IPK_FILE" 2>/dev/null || tar xzf "$IPK_FILE" 2>/dev/null; } )
			if [ -f "$EXTRACT/data.tar.gz" ]; then
				mkdir -p "$EXTRACT/data"
				tar xzf "$EXTRACT/data.tar.gz" -C "$EXTRACT/data" 2>/dev/null
				SHARE="$EXTRACT/data/usr/share/openclaw"
				for want in oc-config.sh oc-config-interactive.js oc-menu-engine.js web-pty.js model-presets.json VERSION; do
					[ -f "$SHARE/$want" ] \
						|| fail "built .ipk is missing /usr/share/openclaw/$want"
				done
				[ -d "$SHARE/ui" ] || fail "built .ipk is missing /usr/share/openclaw/ui/"
			fi
		fi
	fi
fi

echo "ok"
