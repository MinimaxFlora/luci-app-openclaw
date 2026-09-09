#!/bin/sh
# ============================================================================
# 本地构建 .apk 包 (OpenWrt 25.x / ZeroWrt 25.x, apk 包管理)
# 用法: sh scripts/build_apk.sh [output_dir]
#
# 与 build_ipk.sh 对称的 apk 产物入口: 产出 luci-app-openclaw_<ver>-r1_all.apk。
# .apk 为 apk-tools v3 容器格式 (无法用 tar/ar 手拼), 因此走官方 OpenWrt
# main SDK 链路 (luci.mk, 与固件集成编译同一路径): 无需本地预装 SDK,
# 脚本自动用 Docker 复用官方 SDK 镜像 ghcr.io/openwrt/sdk:x86_64-main。
# 需可联网且宿主可用 docker (CI 与 Docker 环境均可)。
# ============================================================================
set -e

command -v docker >/dev/null 2>&1 || {
	echo "错误: 未找到 docker。.apk 需通过官方 OpenWrt SDK 镜像构建 (见脚本头说明)。" >&2
	exit 1
}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PKG_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
OUT_DIR="${1:-$PKG_DIR/dist}"
case "$OUT_DIR" in
	/*) ;;
	*) OUT_DIR="$PKG_DIR/$OUT_DIR" ;;
esac
mkdir -p "$OUT_DIR"

PKG_NAME="luci-app-openclaw"
PKG_VERSION=$(cat "$PKG_DIR/VERSION" 2>/dev/null | tr -d '[:space:]' || echo "1.0.0")
SDK_IMAGE="${SDK_IMAGE:-ghcr.io/openwrt/sdk:x86_64-main}"

echo "=== 构建 ${PKG_NAME} .apk 包 ==="
echo "SDK 镜像: ${SDK_IMAGE}"
echo "版本: ${PKG_VERSION}"
echo "输出到: ${OUT_DIR}"

# ── 准备 SDK feed (仓库 → <feed>/luci-app-openclaw) ──
FEED=$(mktemp -d)
trap 'rm -rf "$FEED"' EXIT
mkdir -p "$FEED/luci-app-openclaw"
tar --exclude='./.git' --exclude='./dist' -C "$PKG_DIR" -cf - . | tar -C "$FEED/luci-app-openclaw" -xf -
ls "$FEED/luci-app-openclaw/Makefile" >/dev/null

# Windows (git-bash/MSYS) 下 docker 需要原生 Windows 路径
case "$(uname 2>/dev/null || true)" in
	MINGW*|MSYS*)
		FEED=$(cygpath -w "$FEED")
		OUT_DIR=$(cygpath -w "$OUT_DIR")
		;;
esac

# ── 官方 main SDK 容器内编译 (镜像自带 setup.sh / feeds, 与 gh-action-sdk 同链路) ──
docker run --rm \
	-v "$FEED":/feed:ro \
	-v "$OUT_DIR":/out:rw \
	"$SDK_IMAGE" /bin/sh -c '
	set -e
	# snapshot 镜像不带 SDK, 先运行自带 setup.sh 下载解压
	[ -f setup.sh ] && bash setup.sh
	# 默认 feeds (含 luci), 并把本地包注册为 feed
	sed \
		-e "s,https://git.openwrt.org/feed/,https://github.com/openwrt/," \
		-e "s,https://git.openwrt.org/openwrt/,https://github.com/openwrt/," \
		feeds.conf.default > feeds.conf
	echo "src-link openclaw /feed" >> feeds.conf
	./scripts/feeds update -a
	make defconfig
	./scripts/feeds install -p openclaw -f luci-app-openclaw
	# 编译 (luci.mk: htdocs/root/po 全自动打包, 版本来自 VERSION 注入的 Makefile)
	make package/luci-app-openclaw/compile V=s -j"$(nproc)"
	# 收集 .apk
	find bin/packages -type f -name "luci-app-openclaw_*.apk" -exec cp -v {} /out/ \;
'

echo ""
echo "=== 构建完成 ==="
ls -lh "$OUT_DIR"/luci-app-openclaw_*.apk
echo ""
echo "安装方法 (OpenWrt 25.x / ZeroWrt 25.x):"
echo "  apk add --allow-untrusted luci-app-openclaw_${PKG_VERSION}-r1_all.apk"
