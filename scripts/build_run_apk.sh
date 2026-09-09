#!/bin/sh
# ============================================================================
# OpenWrt 25.x (apk) .run 自解压安装包构建脚本
# 用法: sh scripts/build_run_apk.sh [工作目录=dist]
#
# 与 build_run.sh (.ipk/.opkg 版) 对应 —— 本脚本面向 apk 包管理的固件
# (OpenWrt 25.x / ZeroWrt 25.x 等, 无 opkg)。前置产物:
#   <dir>/luci-app-openclaw_<ver>-r1_all.apk
#   <dir>/luci-i18n-openclaw-zh-cn_<ver>-r1_all.apk
# 由 OpenWrt SDK (luci.mk) 构建; 安装器通过 `apk add --allow-untrusted`
# 安装内嵌的 .apk, 依赖由 apk 从固件仓库自动解析。
# ============================================================================
set -e

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PKG_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
OUT_DIR="${1:-$PKG_DIR/dist}"
# 确保 OUT_DIR 是绝对路径
case "$OUT_DIR" in
	/*) ;;
	*) OUT_DIR="$PKG_DIR/$OUT_DIR" ;;
esac
mkdir -p "$OUT_DIR"
PKG_NAME="luci-app-openclaw"
PKG_VERSION=$(cat "$PKG_DIR/VERSION" 2>/dev/null | tr -d '[:space:]' || echo "1.0.0")

echo "=== 构建 OpenWrt 25.x (apk) .run 安装包 ==="
echo "输出到: $OUT_DIR"

# 前置检查: 需要 SDK 构建出的 .apk 产物
APP_APK=$(ls "$OUT_DIR"/${PKG_NAME}_*.apk 2>/dev/null | head -1 || true)
I18N_APK=$(ls "$OUT_DIR"/luci-i18n-${PKG_NAME}-zh-cn_*.apk 2>/dev/null | head -1 || true)
if [ -z "$APP_APK" ]; then
	echo "错误: 未找到 ${PKG_NAME}_*.apk, 请先用 OpenWrt 25.x SDK (luci.mk) 构建, 例如:"
	echo "  make package/luci-app-openclaw/compile V=s"
	echo "  cp bin/packages/*/luci-app-openclaw_*.apk bin/packages/*/luci-i18n-*.apk \"$OUT_DIR/\""
	exit 1
fi
echo "内嵌 .apk 产物:"
echo "  $(basename "$APP_APK")"
[ -n "$I18N_APK" ] && echo "  $(basename "$I18N_APK")"

# ── 安装器 (自解压头) ──
create_installer() {
	cat > "$STAGING/install.sh" << 'INSTALLER_EOF'
#!/bin/sh
# luci-app-openclaw — OpenWrt 25.x (apk 包管理) 安装器
echo "=================================================="
echo " luci-app-openclaw 安装器 (apk 版本)"
echo "=================================================="

if [ ! -f /etc/openwrt_release ]; then
	echo "错误: 此安装包仅适用于 OpenWrt / ZeroWrt 系统"
	exit 1
fi

ARCH=$(uname -m)
case "$ARCH" in
	x86_64|aarch64) ;;
	*) echo "错误: 不支持的架构 $ARCH (仅支持 x86_64/aarch64)"; exit 1 ;;
esac

if ! command -v apk >/dev/null 2>&1; then
	echo "错误: 未检测到 apk 包管理器。"
	echo "本安装包适用于 OpenWrt 25.x / ZeroWrt 25.x 等 apk 固件;"
	echo "opkg 固件请改用 luci-app-openclaw_*.run (opkg 版) 或 .ipk 安装。"
	exit 1
fi

WORK=$(mktemp -d)
trap "rm -rf '$WORK'" EXIT

echo ""
echo "[1/3] 解压安装包..."
ARCHIVE_LINE=$(awk '/^__ARCHIVE_BELOW__$/{print NR + 1; exit 0}' "$0")
tail -n +"$ARCHIVE_LINE" "$0" | tar xzf - -C "$WORK"
echo "  完成 ($WORK)"

echo "[2/3] 通过 apk 安装 (依赖由固件仓库自动解析)..."
cd "$WORK"
OK=1
for f in *.apk; do
	[ -f "$f" ] || continue
	echo "  apk add --allow-untrusted $f"
	if ! apk add --allow-untrusted "$f" 2>&1; then
		echo "  首次安装失败, 尝试 apk update 后重试..."
		apk update >/dev/null 2>&1 || true
		if ! apk add --allow-untrusted "$f" 2>&1; then
			OK=0
			echo "  安装 $f 失败, 请检查固件软件源是否包含依赖 (luci-base/curl/...)"
		fi
	fi
done
if [ "$OK" != "1" ]; then
	echo "错误: 存在安装失败的软件包, 请查看上方输出"
	exit 1
fi

echo "[3/3] 触发初始化与权限修复..."
# 运行 uci-defaults (等价于首次 opkg/apk 安装时的配置初始化)
if [ -f /etc/uci-defaults/99-openclaw ]; then
	( . /etc/uci-defaults/99-openclaw ) && rm -f /etc/uci-defaults/99-openclaw
fi
if [ -x /usr/libexec/openclaw-permissions.sh ] && [ -d /opt/openclaw/data/.openclaw ]; then
	/usr/libexec/openclaw-permissions.sh fix-state /opt/openclaw/data/.openclaw >/dev/null 2>&1 || true
fi
# 注册 rpcd exec 插件 (ubus object "openclaw")
if [ -x /usr/libexec/rpcd/openclaw ] && [ -x /etc/init.d/rpcd ]; then
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
fi
# 若启用则拉起服务
if [ "$(uci -q get openclaw.main.enabled 2>/dev/null || echo 0)" = "1" ] && [ -x /etc/init.d/openclaw ]; then
	/etc/init.d/openclaw enable >/dev/null 2>&1 || true
	/etc/init.d/openclaw start >/dev/null 2>&1 || true
fi
rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* /tmp/luci-indexcache.*.json 2>/dev/null

echo ""
echo "✅ 安装完成！"
echo ""
echo "卸载: apk del luci-app-openclaw luci-i18n-openclaw-zh-cn"
echo "后续步骤:"
echo "  1. 运行 openclaw-env setup  — 下载 Node.js 并安装 OpenClaw"
echo "  2. 访问 LuCI → 服务 → OpenClaw 进行配置"
echo ""
exit 0
__ARCHIVE_BELOW__
INSTALLER_EOF
}

# 构建
echo ""
echo "[1/3] 准备暂存区..."
STAGING=$(mktemp -d)
trap "rm -rf '$STAGING'" EXIT
mkdir -p "$STAGING/payload"
cp "$APP_APK" "$STAGING/payload/"
[ -n "$I18N_APK" ] && cp "$I18N_APK" "$STAGING/payload/"

echo "[2/3] 创建安装器..."
create_installer
sed -i "s|__PKG_VERSION__|${PKG_VERSION}|g" "$STAGING/install.sh"

echo "[3/3] 打包..."
# payload 归属固定为 root:root
(cd "$STAGING/payload" && tar --owner=0 --group=0 --numeric-owner -czf "$STAGING/payload.tar.gz" .)

RUN_FILE="$OUT_DIR/${PKG_NAME}_${PKG_VERSION}_apk.run"
cat "$STAGING/install.sh" "$STAGING/payload.tar.gz" > "$RUN_FILE"
chmod +x "$RUN_FILE"

FILE_SIZE=$(wc -c < "$RUN_FILE" | tr -d ' ')
echo ""
echo "=== 构建完成 ==="
echo "输出文件: $RUN_FILE"
echo "文件大小: $FILE_SIZE bytes"
echo ""
echo "安装方法: sh ${PKG_NAME}_${PKG_VERSION}_apk.run   (OpenWrt 25.x / ZeroWrt 25.x, 需 apk)"
