'use strict';
'require baseclass';
'require rpc';

/**
 * openclaw.api — 统一 RPC 封装 (ubus object: openclaw, rpcd exec plugin)
 *
 * Replaces every former LuCI controller JSON endpoint
 * (luasrc/controller/openclaw.lua action_* handlers). Views only talk to
 * these wrappers — no endpoint URL / XHR / CSRF plumbing anywhere in the UI.
 *
 * ubus 参数按下面的声明顺序位置映射 —— params 必须是 ARRAY 风格。
 * (luci rpc.declare 的 object 风格要求第一个实参是对象字面量,
 *  位置传参会得到空参数 —— 2026-09 设备配对 approve-all 即踩此坑。)
 */
return baseclass.extend((function() {
const api = {};

api.status          = rpc.declare({ object: 'openclaw', method: 'status', params: {} });
api.setupLog        = rpc.declare({ object: 'openclaw', method: 'setup_log', params: {} });
api.checkUpdate     = rpc.declare({ object: 'openclaw', method: 'check_update', params: {} });
api.uninstall       = rpc.declare({ object: 'openclaw', method: 'uninstall', params: {} });
api.getToken        = rpc.declare({ object: 'openclaw', method: 'get_token', params: {} });
api.pluginUpgrade   = rpc.declare({ object: 'openclaw', method: 'plugin_upgrade', params: ['version'] });
api.pluginUpgradeLog = rpc.declare({ object: 'openclaw', method: 'plugin_upgrade_log', params: {} });
api.checkSystem     = rpc.declare({ object: 'openclaw', method: 'check_system', params: ['install_path'] });
api.wechatStatus    = rpc.declare({ object: 'openclaw', method: 'wechat_status', params: {} });
api.wechatInstall   = rpc.declare({ object: 'openclaw', method: 'wechat_install', params: {} });
api.wechatInstallLog = rpc.declare({ object: 'openclaw', method: 'wechat_install_log', params: {} });
api.wechatLogin     = rpc.declare({ object: 'openclaw', method: 'wechat_login', params: {} });
api.wechatLoginStatus = rpc.declare({ object: 'openclaw', method: 'wechat_login_status', params: {} });
api.wechatLogout    = rpc.declare({ object: 'openclaw', method: 'wechat_logout', params: ['account'] });
api.wechatCheckUpgrade = rpc.declare({ object: 'openclaw', method: 'wechat_check_upgrade', params: {} });
api.wechatUpgradePlugin = rpc.declare({ object: 'openclaw', method: 'wechat_upgrade_plugin', params: {} });
api.wechatUninstall = rpc.declare({ object: 'openclaw', method: 'wechat_uninstall', params: {} });
api.devicesList     = rpc.declare({ object: 'openclaw', method: 'devices_list', params: {} });
api.devicesApprove  = rpc.declare({ object: 'openclaw', method: 'devices_approve', params: ['request_id', 'all'] });

/** service control / install / core upgrade */
api.serviceCtl = rpc.declare({
	object: 'openclaw',
	method: 'service_ctl',
	params: ['action', 'version', 'install_path']
});

/** config backup: action ∈ create|verify|list|delete|restore */
api.backup = rpc.declare({
	object: 'openclaw',
	method: 'backup',
	params: ['action', 'only_config', 'file']
});

/** convenience wrappers (named arguments) */
api.service = {
	start: () => api.serviceCtl('start'),
	stop: () => api.serviceCtl('stop'),
	restart: () => api.serviceCtl('restart'),
	enable: () => api.serviceCtl('enable'),
	disable: () => api.serviceCtl('disable'),
	setup: (version, installPath) => api.serviceCtl('setup', version || 'stable', installPath || ''),
	coreUpgrade: (version) => api.serviceCtl('upgrade', version || 'latest')
};

return api;
})());
