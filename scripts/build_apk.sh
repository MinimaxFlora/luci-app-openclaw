#!/bin/sh
# ============================================================================
# 本地构建 .apk 包 (OpenWrt 25.x / ZeroWrt 25.x, apk 包管理)
# 用法: sh scripts/build_apk.sh [output_dir]
#
# 与 build_ipk.sh 完全对称的 .apk 产物入口:
#   产物  luci-app-openclaw_<ver>-r1_all.apk  (PKG_VERSION/PKG_RELEASE 同 ipk)
#   依赖  luci-base, curl, openssl-util, script-utils, coreutils-stty,
#         tar, libstdcpp6, libubox, jshn           (同 ipk control)
#   安装  apk add --allow-untrusted luci-app-openclaw_<ver>-r1_all.apk
#
# 说明: .apk 是 apk-tools v3 二进制容器格式 (魔数 ADBd), 无法像 .ipk 那样
# 用 tar/ar 手工拼装 (真机实测 v2 包会被拒: "v2 package format error")。
# 因此文件清单/权限/版本注入全部委托 OpenWrt 官方链路 luci.mk 完成,
# 与固件集成编译 (make package/luci-app-openclaw/compile) 完全同源。
# 编译环境二选一:
#   1) OPENWRT_SDK_DIR 已设置 (本地已解压的 OpenWrt SDK, 含 luci feed):
#        OPENWRT_SDK_DIR=/path/to/sdk sh scripts/build_apk.sh dist
#   2) 默认: 自动用 Docker 官方 SDK 镜像 ghcr.io/openwrt/sdk:x86_64-main
#      (需联网且宿主可用 docker, CI 即此路径)。
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
PKG_RELEASE="1"

echo "=== 构建 ${PKG_NAME} .apk 包 ==="

# 准备一个只含本仓库内容的干净目录 (排除 .git/dist, 避免泄漏到 SDK 与包内)
STAGING=$(mktemp -d)
trap "rm -rf '$STAGING'" EXIT
mkdir -p "$STAGING/luci-app-openclaw"
tar --exclude='./.git' --exclude='./dist' -C "$PKG_DIR" -cf - . \
	| tar -C "$STAGING/luci-app-openclaw" -xf -
# 版本注入 (与 workflow 的 Inject version 一致: Makefile 读 VERSION)
printf '%s' "$PKG_VERSION" > "$STAGING/luci-app-openclaw/VERSION"

# ── 编译环境: 本地 SDK 或 Docker 官方 SDK 镜像 ──
if [ -n "${OPENWRT_SDK_DIR:-}" ]; then
	# 模式 1: 本地 SDK (WSL/构建机预装, 与固件集成同一目录)
	SDK_DIR="$OPENWRT_SDK_DIR"
	[ -f "$SDK_DIR/Makefile" ] || {
		echo "错误: OPENWRT_SDK_DIR 不是有效的 OpenWrt SDK 目录 ($SDK_DIR)" >&2
		exit 1
	}
	echo "编译方式: 本地 SDK ($SDK_DIR)"
	rm -rf "$SDK_DIR/package/$PKG_NAME"
	mkdir -p "$SDK_DIR/package"
	cp -r "$STAGING/$PKG_NAME" "$SDK_DIR/package/$PKG_NAME"
	(
		cd "$SDK_DIR"
		make package/$PKG_NAME/compile V=s -j"$(nproc)"
	)
	find "$SDK_DIR/bin/packages" -type f -name "${PKG_NAME}_*.apk" -exec cp -v {} "$OUT_DIR/" \;
else
	# 模式 2: Docker 官方 OpenWrt main SDK 镜像 (CI 默认路径)
	command -v docker >/dev/null 2>&1 || {
		echo "错误: 未找到 docker, 且未设置 OPENWRT_SDK_DIR。" >&2
		echo "请安装 docker, 或设 OPENWRT_SDK_DIR=<sdk路径> 走本地 SDK 编译。" >&2
		exit 1
	}
	SDK_IMAGE="${SDK_IMAGE:-ghcr.io/openwrt/sdk:x86_64-main}"
	echo "编译方式: Docker SDK 镜像 ($SDK_IMAGE)"

	FEED_MOUNT="$STAGING"
	OUT_MOUNT=$(cd "$OUT_DIR" && pwd)
	case "$(uname 2>/dev/null || true)" in
		MINGW*|MSYS*)
			FEED_MOUNT=$(cygpath -w "$STAGING")
			OUT_MOUNT=$(cygpath -w "$OUT_MOUNT")
			;;
	esac

	docker run --rm \
		-v "$FEED_MOUNT":/feed:ro \
		-v "$OUT_MOUNT":/out:rw \
		"$SDK_IMAGE" /bin/sh -c '
		set -e
		# snapshot 镜像不带 SDK, 先运行自带 setup.sh 下载解压
		[ -f setup.sh ] && bash setup.sh
		sed \
			-e "s,https://git.openwrt.org/feed/,https://github.com/openwrt/," \
			-e "s,https://git.openwrt.org/openwrt/,https://github.com/openwrt/," \
			feeds.conf.default > feeds.conf
		echo "src-link openclaw /feed" >> feeds.conf
		./scripts/feeds update -a
		make defconfig
		./scripts/feeds install -p openclaw -f '"$PKG_NAME"'
		make package/'"$PKG_NAME"'/compile V=s -j"$(nproc)"
		find bin/packages -type f -name "'"$PKG_NAME"'_*.apk" -exec cp -v {} /out/ \;
	'
fi

APK_FILE="$OUT_DIR/${PKG_NAME}_${PKG_VERSION}-${PKG_RELEASE}_all.apk"
APK_SIZE=$(wc -c < "$APK_FILE" 2>/dev/null | tr -d ' ')
echo ""
echo "=== 构建完成 ==="
echo "输出文件: $APK_FILE"
echo "文件大小: ${APK_SIZE} bytes"
echo ""
echo "安装方法 (OpenWrt 25.x / ZeroWrt 25.x):"
echo "  apk add --allow-untrusted ${PKG_NAME}_${PKG_VERSION}-${PKG_RELEASE}_all.apk"
