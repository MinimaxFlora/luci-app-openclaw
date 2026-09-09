# luci-app-openclaw — OpenWrt package Makefile (LuCI JS plugin)
#
# Modern LuCI JavaScript architecture (Lua UI 已全部迁移):
#   htdocs/luci-static/resources/...  JS views + RPC 封装
#   root/usr/libexec/rpcd/openclaw     rpcd exec plugin (ubus "openclaw")
#   root/usr/share/luci/menu.d         LuCI menu
#   po/zh_Hans                         gettext 翻译 (luci-i18n-openclaw-zh-cn)
#
# 打包完全交给 feeds/luci/luci.mk (与 luci-app-mosdns / luci-app-ota 同款):
#   - htdocs/* → /www/luci-static/...  (自动)
#   - root/*   → / (自动, cp -pR 保留权限)
#   - po/<lang> → 自动生成独立 luci-i18n-openclaw-<lang> 包 (po2lmo)
#   - postinst 若未自定义则生成默认; 下面的自定义 postinst 会被保留 (ifndef)

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-openclaw
PKG_VERSION:=$(strip $(shell cat $(CURDIR)/VERSION 2>/dev/null || echo "1.0.0"))
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0

# luci.mk 读取 LUCI_MAINTAINER/LUCI_URL (默认指向 OpenWrt 官方), 这里覆盖为本项目作者
LUCI_URL:=https://github.com/10000ge10000/luci-app-openclaw
LUCI_MAINTAINER:=10000ge10000 <10000ge10000@users.noreply.github.com>

LUCI_TITLE:=OpenClaw AI 网关 LuCI 管理插件
LUCI_PKGARCH:=all
# 现代 JS UI 不再需要 luci-compat; jshn 供 rpcd exec 插件 (backend)
# 注意: 不声明 C++/libubox 运行时依赖 —
#  - 23.05 系 C++ 符号是 libstdcpp6、master 是 libstdcpp, 且插件无 C++ 组件;
#  - master(snapshot) 把 libubox 按快照日期改名 (libubox2026xxxx): 直接声明会把
#    具体日期包名写进 Depends, 固件仓库若为其它快照日期则 apk 报 no such package。
#    libubox/jshn.sh 由 luci-base/ubus 依赖链保证存在。
LUCI_DEPENDS:=+luci-base +curl +openssl-util +script-utils +coreutils-stty +tar +jshn

define Package/$(PKG_NAME)/conffiles
/etc/config/openclaw
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	( . /etc/uci-defaults/99-openclaw ) && rm -f /etc/uci-defaults/99-openclaw
	OPENCLAW_INSTALL_BASE="$$(uci -q get openclaw.main.install_path 2>/dev/null || echo /opt)"
	if [ -r /usr/libexec/openclaw-paths.sh ]; then
		. /usr/libexec/openclaw-paths.sh
		oc_load_paths "$${OPENCLAW_INSTALL_BASE}" 2>/dev/null || true
	else
		OPENCLAW_INSTALL_BASE="$${OPENCLAW_INSTALL_BASE%/}"
		OC_DATA="$${OPENCLAW_INSTALL_BASE}/openclaw/data"
	fi
	if [ -n "$${OC_DATA:-}" ] && [ -d "$${OC_DATA}/.openclaw" ] && [ -x /usr/libexec/openclaw-permissions.sh ]; then
		/usr/libexec/openclaw-permissions.sh fix-state "$${OC_DATA}/.openclaw" >/dev/null 2>&1 || true
	fi
	if [ "$$(uci -q get openclaw.main.enabled 2>/dev/null || echo 0)" = "1" ] && [ -x /etc/init.d/openclaw ]; then
		/etc/init.d/openclaw enable >/dev/null 2>&1 || true
		/etc/init.d/openclaw start >/dev/null 2>&1 || true
	fi
	# 注册 rpcd exec 插件 (ubus object "openclaw"), 供 JS 视图调用
	if [ -x /usr/libexec/rpcd/openclaw ] && [ -x /etc/init.d/rpcd ]; then
		/etc/init.d/rpcd restart >/dev/null 2>&1 || true
	fi
	rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* /tmp/luci-indexcache.*.json 2>/dev/null
	exit 0
}
endef

define Package/$(PKG_NAME)/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache /tmp/luci-modulecache/* /tmp/luci-indexcache.*.json 2>/dev/null
}
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
