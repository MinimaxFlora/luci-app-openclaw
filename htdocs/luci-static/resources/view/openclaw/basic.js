'use strict';
'require view';
'require ui';
'require dom';
'require openclaw.api as api';
'require openclaw.common as oc';


/*
 * 基本设置 (迁移自 luasrc/model/cbi/openclaw/basic.lua + luasrc/view/openclaw/status.htm)
 *
 * 页面内容与文字 1:1 保留: 状态面板 → 快捷操作 → 安装/升级/备份向导 → 使用指南。
 * 所有后端调用经由 openclaw.api (ubus), 无直接 XHR/CSRF 逻辑。
 */
return view.extend({
	render: function() {
		const style = [
			'#oc-status-panel{margin:0 0 20px 0;padding:0;border:1px solid #e0e0e0;border-radius:8px;background:#fff;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);}',
			'#oc-status-panel .panel-title{background:linear-gradient(135deg,#4a90d9,#357abd);color:#fff;padding:10px 16px;font-size:14px;font-weight:600;letter-spacing:0.5px;}',
			'#oc-status-panel .panel-body{padding:0;}',
			'#oc-status-panel table{width:100%;border-collapse:collapse;}',
			'#oc-status-panel td{padding:8px 16px;border-bottom:1px solid #f2f2f2;font-size:13px;vertical-align:middle;}',
			'#oc-status-panel tr:last-child td{border-bottom:none;}',
			'#oc-status-panel td:first-child{width:120px;color:#888;font-weight:500;white-space:nowrap;}',
			'#oc-status-panel td:last-child{color:#333;}',
			'.oc-badge{display:inline-block;padding:2px 12px;border-radius:12px;font-size:12px;font-weight:600;}',
			'.oc-badge-running{background:#e6f7e9;color:#1a7f37;}',
			'.oc-badge-stopped{background:#ffeef0;color:#cf222e;}',
			'.oc-badge-starting{background:#fff8c5;color:#9a6700;}',
			'.oc-badge-failed{background:#ffeef0;color:#cf222e;}',
			'.oc-badge-disabled{background:#f0f0f0;color:#656d76;}',
			'.oc-badge-unknown{background:#fff8c5;color:#9a6700;}',
			'.oc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;vertical-align:middle;}',
			'.oc-dot-green{background:#1a7f37;}',
			'.oc-dot-red{background:#cf222e;}',
			'.oc-dot-gray{background:#999;}',
			'#oc-update-action .ver-badge-new{display:inline-flex;align-items:center;padding:3px 10px;border-radius:16px;font-size:12px;font-weight:600;background:linear-gradient(135deg,#fff7e6 0%,#ffe7ba 100%);color:#9a6700;border:1px solid #f5a623;}',
			'#oc-update-action .ver-badge-latest{display:inline-flex;align-items:center;padding:3px 10px;border-radius:16px;font-size:12px;font-weight:600;background:linear-gradient(135deg,#e6f7e6 0%,#c8f7c8 100%);color:#1a7f1a;border:1px solid #28a745;}',
			'#oc-update-action .ver-badge-unknown{display:inline-flex;align-items:center;padding:3px 10px;border-radius:16px;font-size:12px;font-weight:600;background:#f6f8fa;color:#656d76;border:1px solid #d0d7de;}',
			'#oc-update-action .ver-tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-family:SF Mono,Consolas,Menlo,monospace;background:#e1e4e8;color:#24292f;margin-left:4px;}'
		].join('\n');

		const html =
			'<style>' + style + '</style>' +
			'<h2>' + _('OpenClaw AI Gateway') + '</h2>' +
			'<div class="cbi-map-descr">' + _('OpenClaw is an AI coding-agent gateway supporting GitHub Copilot, Claude, GPT, Gemini and other large models as well as QQ, Telegram, Discord and other messaging channels.') + '</div>' +
			'<div id="oc-status-panel">' +
			'<div class="panel-title" id="oc-panel-title">' + _('🦞 OpenClaw Service Status') + '</div>' +
			'<div class="panel-body"><table>' +
			'<tr>' + '<td>' + _('Run State') + '</td>' + '<td id="oc-st-status">' + '<span class="oc-badge oc-badge-unknown">' + _('Loading...') + '</span>' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Gateway Service') + '</td>' + '<td id="oc-st-gateway">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Config Terminal') + '</td>' + '<td id="oc-st-pty">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Active Model') + '</td>' + '<td id="oc-st-model">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Message Channels') + '</td>' + '<td id="oc-st-channels">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Process PID') + '</td>' + '<td id="oc-st-pid">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Memory Usage') + '</td>' + '<td id="oc-st-mem">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Uptime') + '</td>' + '<td id="oc-st-uptime">' + '-' + '</td>' + '</tr>' +
			'<tr><td>Node.js</td><td id="oc-st-node">-</td></tr>' +
			'<tr><td>OpenClaw</td><td id="oc-st-oc-ver">-</td></tr>' +
			'<tr>' + '<td>' + _('Plugin Version') + '</td>' + '<td id="oc-st-plugin">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Install Path') + '</td>' + '<td id="oc-st-path">' + '-' + '</td>' + '</tr>' +
			'<tr>' + '<td>' + _('Free Space') + '</td>' + '<td id="oc-st-disk">' + '-' + '</td>' + '</tr>' +
			'</table></div></div>' +

			'<fieldset class="cbi-section" id="oc-quick-section">' + '<legend>' + _('Quick Actions') + '</legend>' + '<div class="cbi-section-node">' +
			'<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">' +
			'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-setup" title="Download Node.js and install OpenClaw">' + _('📦 Install Runtime') + '</button>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-restart">' + _('🔄 Restart Service') + '</button>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-stop">' + _('⏹️ Stop Service') + '</button>' +
			'<span style="position:relative;display:inline-block;" id="btn-check-update-wrap">' + '<button class="btn cbi-button cbi-button-action" type="button" id="btn-check-update">' + _('🔍 Check for Updates') + '</button>' + '<span id="update-dot" style="display:none;position:absolute;top:-2px;right:-2px;width:10px;height:10px;background:#e36209;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #e36209;">' + '</span>' + '</span>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-backup" title="Back up or restore the OpenClaw configuration">' + _('💾 Backup / Restore') + '</button>' +
			'<button class="btn cbi-button cbi-button-remove" type="button" id="btn-uninstall" title="Remove the Node.js and OpenClaw runtime plus related data">' + _('🗑️ Uninstall') + '</button>' +
			'</div>' +
			'<div id="action-result" style="margin-top:8px;"></div>' +
			'<div id="oc-update-action" style="margin-top:8px;display:none;"></div>' +
			'</div></fieldset>' +

			/* 安装日志面板 (默认隐藏) */
			'<div id="setup-log-panel" style="display:none;margin-top:12px;">' +
			'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
			'<span id="setup-log-title" style="font-weight:600;font-size:14px;">' + _('📋 Install Log') + '</span>' +
			'<span id="setup-log-status" style="font-size:12px;color:#999;"></span></div>' +
			'<pre id="setup-log-content" style="background:#1a1b26;color:#a9b1d6;padding:14px 16px;border-radius:6px;font-size:12px;line-height:1.6;max-height:400px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;border:1px solid #2d333b;margin:0;"></pre>' +
			'<div id="setup-log-result" style="margin-top:10px;display:none;"></div></div>' +

			/* 使用指南 (原 basic.lua 尾部) */
			'<div style="border:1px solid #d0e8ff;background:#f0f7ff;padding:14px 18px;border-radius:6px;margin-top:12px;line-height:1.8;font-size:13px;">' +
			'<strong style="font-size:14px;">' + _('📖 Quick Start') + '</strong>' + '<br/>' +
			'<span style="color:#555;">' +
			_('① Click ') + '<b>' + _('“Install Runtime”') + '</b>' + _(' on first use — the service auto-starts when done') + '<br/>' +
			_('② Open ') + '<b>' + _('“Config Management”') + '</b>' + _(' and use the interactive wizard to configure your AI models and API keys') + '<br/>' +
			_('③ Head to ') + '<b>' + _('“Web Console”') + '</b>' + _(' to set up messaging channels and start chatting') + '</span>' +
			'<div style="margin-top:10px;padding-top:10px;border-top:1px solid #d0e8ff;">' +
			'<span style="color:#888;">' + _('Questions? Follow us on Bilibili and leave a comment:') + '</span>' +
			'<a href="https://space.bilibili.com/59438380" target="_blank" rel="noopener" style="color:#00a1d6;font-weight:bold;text-decoration:none;">🔗 space.bilibili.com/59438380</a>' +
			'<span style="margin-left:16px;color:#888;">' + _('GitHub project:') + '</span>' +
			'<a href="https://github.com/10000ge10000/luci-app-openclaw" target="_blank" rel="noopener" style="color:#24292f;font-weight:bold;text-decoration:none;">🐙 10000ge10000/luci-app-openclaw</a>' +
			'</div></div>' +

			/* 版本选择对话框 (原 CBI 内联样式) */
			'<div id="oc-setup-dialog" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;">' +
			'<div style="background:#fff;border-radius:12px;padding:24px 28px;max-width:520px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">' +
			'<h3 style="margin:0 0 16px 0;font-size:16px;color:#333;">' + _('📦 Choose an Install Version') + '</h3>' +
			'<div style="display:flex;flex-direction:column;gap:12px;">' +
			'<label style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border:2px solid #4a90d9;border-radius:8px;cursor:pointer;background:#f0f7ff;" id="oc-opt-stable">' +
			'<input type="radio" name="oc-ver-choice" value="stable" checked style="margin-top:2px;">' +
			'<div>' + '<strong style="color:#333;">' + _('✅ Stable (Recommended)') + '</strong>' +
			'<div style="font-size:12px;color:#666;margin-top:4px;" id="oc-stable-desc">' + _('Version v2026.9.1 (validated) — fully tested, good compatibility.') + '</div>' +
			'</div></label>' +
			'<label style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;background:#fff;" id="oc-opt-latest">' +
			'<input type="radio" name="oc-ver-choice" value="latest" style="margin-top:2px;">' +
			'<div>' + '<strong style="color:#333;">' + _('🆕 Latest (Unverified)') + '</strong>' +
			'<div style="font-size:12px;color:#e36209;margin-top:4px;">' + _('⚠️ Installs the newest published npm version (unverified) — it may have unverified compatibility issues.') + '</div>' +
			'</div></label>' +
			'</div>' +
			'<div style="margin-top:16px;padding-top:14px;border-top:1px solid #eee;">' +
			'<div style="font-weight:600;font-size:13px;color:#333;margin-bottom:8px;">' + _('📂 Install Path') + '</div>' +
			'<div style="display:flex;gap:8px;align-items:center;">' +
			'<input type="text" id="oc-install-path" value="/opt" style="flex:1;padding:8px 12px;border:1px solid #d0d7de;border-radius:6px;font-size:13px;" placeholder="/opt">' +
			'<button class="btn cbi-button" type="button" id="btn-check-path" style="font-size:12px;padding:4px 10px;">' + _('Check Space') + '</button>' +
			'</div>' +
			'<div id="oc-path-info" style="font-size:11px;color:#666;margin-top:6px;">' + _('💡 An openclaw folder will be created under this path. At least 2GB of free space is required. If installing on a second disk, make sure it is mounted.') + '</div>' +
			'</div>' +
			'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">' +
			'<button class="btn cbi-button" type="button" id="btn-setup-cancel" style="min-width:80px;">' + _('Cancel') + '</button>' +
			'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-setup-confirm" style="min-width:80px;">' + _('Start Install') + '</button>' +
			'</div></div></div>' +

			/* 备份/恢复对话框 */
			'<div id="oc-backup-dialog" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;">' +
			'<div style="background:#fff;border-radius:12px;padding:24px 28px;max-width:520px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">' +
			'<h3 style="margin:0 0 16px 0;font-size:16px;color:#333;">' + _('💾 Backup / Restore Config') + '</h3>' +
			'<div style="margin-bottom:16px;">' +
			'<div style="font-weight:600;font-size:13px;color:#555;margin-bottom:8px;">' + _('📤 Create Backup') + '</div>' +
			'<div style="display:flex;gap:10px;">' +
			'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-bk-config" style="font-size:12px;">' + _('📄 Config Only') + '</button>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-bk-full" style="font-size:12px;">' + _('📦 Config + State Data') + '</button>' +
			'</div>' +
			'<div style="font-size:11px;color:#888;margin-top:6px;">' + _('Config only (~2KB) holds models, channels and plugin settings; a full backup also includes state data such as session history (may be large)') + '</div>' +
			'</div>' +
			'<div style="border-top:1px solid #eee;padding-top:14px;margin-bottom:16px;">' +
			'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
			'<div style="font-weight:600;font-size:13px;color:#555;">' + _('📥 Existing Backups') + '</div>' +
			'<button class="btn cbi-button" type="button" id="btn-bk-refresh" style="font-size:11px;padding:2px 10px;">' + _('🔄 Refresh') + '</button>' +
			'</div>' +
			'<div id="oc-backup-list" style="max-height:260px;overflow-y:auto;"></div>' +
			'</div>' +
			'<div id="oc-backup-result" style="margin-bottom:14px;display:none;"></div>' +
			'<div style="display:flex;justify-content:flex-end;">' +
			'<button class="btn cbi-button" type="button" id="btn-bk-close" style="min-width:80px;">' + _('Close') + '</button>' +
			'</div></div></div>';

		const root = E('div', { 'class': 'cbi-map', 'id': 'content' });

		root.innerHTML = html;

		this.rootEl = root;

		oc.whenAttached(root, () => {
			this.bindEvents();
			this.bindStatusPoll();
			this.startUpdateDotCheck();
		});

		return root;
	},

	load: function() {
		this._setupTimer = null;
		this._pluginUpgradeTimer = null;
		this._lastLogLen = 0;
		this._autoScroll = null;
		this._coreLatestVer = '';
		this._pluginLatestVer = '';
		this._statusTimer = null;
		this._pollErrors = 0;
		this._lastInstallPath = '';

		return Promise.resolve();
	},

	/* legacy CBI had pageaction=false → no save/reset footer */
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	/* 状态轮询 (每 5s, 页面隐藏时暂停 — 与 status.htm 行为一致) */
	bindStatusPoll: function() {
		var self = this;

		var tick = function() {
			api.status().then(function(d) {
				self.renderStatus(d);
			}).catch(function(e) {
				var stEl = oc.$('oc-st-status');
				if (stEl)
					stEl.innerHTML = '<span class="oc-badge oc-badge-unknown">' + _('Query Failed') + '</span>';
			});
		};

		tick();
		this._statusTimer = setInterval(function() {
			if (!document.hidden)
				tick();
		}, 5000);
		document.addEventListener('visibilitychange', function() {
			if (!document.hidden)
				tick();
		});
	},

	renderStatus: function(d) {
		var stEl = oc.$('oc-st-status');

		if (!stEl)
			return;

		if (d.install_path)
			this._lastInstallPath = d.install_path;

		if (d.enabled !== '1')
			stEl.innerHTML = '<span class="oc-badge oc-badge-disabled">' + _('Disabled') + '</span>';
		else if (d.gateway_running)
			stEl.innerHTML = '<span class="oc-badge oc-badge-running">' + _('Running') + '</span>';
		else if (d.gateway_starting)
			stEl.innerHTML = '<span class="oc-badge oc-badge-starting">' + _('⏳ Starting...') + '</span>';
		else if (d.gateway_failed)
			stEl.innerHTML = '<span class="oc-badge oc-badge-failed">' + _('Start Failed') + '</span>';
		else
			stEl.innerHTML = '<span class="oc-badge oc-badge-stopped">' + _('Stopped') + '</span>';

		var gwEl = oc.$('oc-st-gateway');
		if (d.gateway_running)
			gwEl.innerHTML = '<span class="oc-dot oc-dot-green">' + '</span>' + _('Listening on ') + d.port;
		else if (d.gateway_starting)
			gwEl.innerHTML = '<span class="oc-dot oc-dot-gray">' + '</span>' + _('Initializing — usually 20–40 s; longer on first install or under heavy load...');
		else if (d.gateway_failed)
			gwEl.innerHTML = '<span class="oc-dot oc-dot-red">' + '</span>' + _('Start failed, exit code ') + (d.gateway_exit_code || '-');
		else
			gwEl.innerHTML = '<span class="oc-dot oc-dot-red">' + '</span>' + _('Not listening');

		var ptyEl = oc.$('oc-st-pty');
		if (d.pty_running)
			ptyEl.innerHTML = '<span class="oc-dot oc-dot-green">' + '</span>' + _('Listening on ') + d.pty_port;
		else
			ptyEl.innerHTML = '<span class="oc-dot oc-dot-gray">' + '</span>' + _('Not listening');

		oc.$('oc-st-pid').textContent = d.pid || '-';

		var channelsEl = oc.$('oc-st-channels');
		if (d.channels)
			channelsEl.innerHTML = '<span style="color:#1a7f37;font-weight:500;">' + d.channels + '</span>';
		else
			channelsEl.textContent = _('Not configured');

		var modelEl = oc.$('oc-st-model');
		if (d.active_model)
			modelEl.innerHTML = '<code style="padding:2px 8px;background:#f0f3f6;border-radius:4px;font-size:12px;">' + d.active_model + '</code>';
		else
			modelEl.textContent = _('Not configured');

		var memEl = oc.$('oc-st-mem');
		if (d.memory_kb > 0)
			memEl.textContent = (d.memory_kb / 1024).toFixed(1) + ' MB';
		else
			memEl.textContent = '-';

		oc.$('oc-st-uptime').textContent = d.uptime || '-';
		oc.$('oc-st-node').textContent = d.node_version || _('Not installed');
		oc.$('oc-st-oc-ver').textContent = d.oc_version ? ('v' + d.oc_version) : _('Not installed');
		oc.$('oc-st-plugin').textContent = d.plugin_version ? ('v' + d.plugin_version) : '-';

		var pathEl = oc.$('oc-st-path');
		if (d.install_path)
			pathEl.innerHTML = '<code style="padding:2px 8px;background:#f0f3f6;border-radius:4px;font-size:12px;">' + d.install_path + '</code>';
		else
			pathEl.textContent = '-';

		var diskEl = oc.$('oc-st-disk');
		if (d.disk_free)
			diskEl.innerHTML = '<span style="color:#1a7f37;font-weight:500;">' + d.disk_free + '</span>' + _(' available');
		else
			diskEl.textContent = '-';
	},

	bindEvents: function() {
		var self = this;

		oc.$('btn-setup').addEventListener('click', function() { self.openSetupDialog(); });
		oc.$('btn-restart').addEventListener('click', function() { self.serviceCtl('restart'); });
		oc.$('btn-stop').addEventListener('click', function() { self.serviceCtl('stop'); });
		oc.$('btn-check-update').addEventListener('click', function() { self.checkUpdate(false); });
		oc.$('btn-backup').addEventListener('click', function() { self.openBackupDialog(); });
		oc.$('btn-uninstall').addEventListener('click', function() { self.doUninstall(); });

		oc.$('btn-check-path').addEventListener('click', function() { self.checkInstallPath(); });
		oc.$('btn-setup-cancel').addEventListener('click', function() { self.closeSetupDialog(); });
		oc.$('btn-setup-confirm').addEventListener('click', function() { self.confirmSetup(); });
		oc.$('btn-bk-config').addEventListener('click', function() { self.doBackup(1); });
		oc.$('btn-bk-full').addEventListener('click', function() { self.doBackup(0); });
		oc.$('btn-bk-refresh').addEventListener('click', function() { self.loadBackupList(); });
		oc.$('btn-bk-close').addEventListener('click', function() {
			oc.$('oc-backup-dialog').style.display = 'none';
		});
	},

	/* ── 安装向导 ── */
	openSetupDialog: function() {
		var dlg = oc.$('oc-setup-dialog');
		var radios = document.getElementsByName('oc-ver-choice');
		dlg.style.display = 'flex';
		for (var i = 0; i < radios.length; i++) {
			if (radios[i].value === 'stable')
				radios[i].checked = true;
		}
		/* keep the installed base path in the field (from last status) */
		var pathEl = oc.$('oc-install-path');
		if (pathEl && this._lastInstallPath && pathEl.value === '/opt')
			pathEl.value = this._lastInstallPath;
	},

	closeSetupDialog: function() {
		oc.$('oc-setup-dialog').style.display = 'none';
	},

	checkInstallPath: function() {
		var pathEl = oc.$('oc-install-path');
		var infoEl = oc.$('oc-path-info');
		var path = pathEl.value.trim();

		if (!path) {
			path = '/opt';
			pathEl.value = path;
		}

		infoEl.innerHTML = _('⏳ Checking free space...');
		api.checkSystem(path).then(function(r) {
			if (r.disk_ok) {
				infoEl.innerHTML = '<span style="color:#1a7f37;">' + _('✅ Free space: ') + r.disk_free_str +
					_(' (checking path: ') + r.disk_path + ')</span>';
			}
			else {
				infoEl.innerHTML = '<span style="color:#cf222e;">' + _('❌ Not enough space: ') + r.disk_mb +
					_(' MB free, need ≥ 2048 MB (checking path: ') + r.disk_path + ')</span>';
			}
		}).catch(function() {
			infoEl.innerHTML = '<span style="color:#e36209;">' + _('⚠️ Check failed') + '</span>';
		});
	},

	confirmSetup: function() {
		var self = this;
		var btn = oc.$('btn-setup');
		var pathEl = oc.$('oc-install-path');
		var installPath = pathEl.value.trim() || '/opt';

		btn.disabled = true;
		btn.textContent = _('⏳ Checking system configuration...');

		api.checkSystem(installPath).then(function(r) {
			var panel = oc.$('setup-log-panel');
			var logEl = oc.$('setup-log-content');
			var titleEl = oc.$('setup-log-title');
			var statusEl = oc.$('setup-log-status');
			var resultEl = oc.$('setup-log-result');
			var actionEl = oc.$('action-result');

			actionEl.textContent = '';
			panel.style.display = 'block';
			resultEl.style.display = 'none';
			titleEl.textContent = _('📋 Install Log');
			logEl.textContent = '';
			logEl.textContent += '════════════════════════════════════════\n';
			logEl.textContent += _('🔍 Checking system configuration\n');
			logEl.textContent += '════════════════════════════════════════\n';
			logEl.textContent += _('Install path: ') + r.install_path + '\n';
			logEl.textContent += _('Memory: ') + r.memory_mb + _(' MB (need ≥ 1024 MB) — ') + (r.memory_ok ? _('✅ Pass') : _('❌ Fail')) + '\n';
			logEl.textContent += _('Disk: ') + r.disk_mb + _(' MB free (need ≥ 2048 MB) — ') + (r.disk_ok ? _('✅ Pass') : _('❌ Fail')) + '\n';
			logEl.textContent += '\n';

			if (!r.pass) {
				self.closeSetupDialog();
				btn.disabled = false;
				btn.textContent = _('📦 Install Runtime');
				statusEl.innerHTML = '<span style="color:#cf222e;">' + _('❌ System requirements not met') + '</span>';
				logEl.textContent += _('❌ System requirements not met — installation aborted\n');
				logEl.textContent += _('💡 Upgrade your hardware or free up disk space, then retry\n');
				resultEl.style.display = 'block';
				resultEl.innerHTML = '<div style="border:1px solid #f5c6cb;background:#ffeef0;padding:12px 16px;border-radius:6px;">' +
					'<strong style="color:#cf222e;font-size:14px;">' + _('❌ System requirements not met') + '</strong>' + '<br/>' +
					'<div style="margin-top:8px;font-size:12px;color:#666;">' + _('💡 Upgrade your hardware or free up disk space, then retry.') + '</div>' + '</div>';
				return;
			}

			statusEl.innerHTML = '<span style="color:#7aa2f7;">' + _('⏳ Installation in progress...') + '</span>';
			logEl.textContent += _('✅ System check passed — starting the installation...\n\n');
			self.closeSetupDialog();

			var choice = 'stable';
			var radios = document.getElementsByName('oc-ver-choice');
			for (var i = 0; i < radios.length; i++) {
				if (radios[i].checked) {
					choice = radios[i].value;
					break;
				}
			}

			self.startSetup(choice, r.install_path);
		}).catch(function(e) {
			self.closeSetupDialog();
			btn.disabled = false;
			btn.textContent = _('📦 Install Runtime');
			alert(_('System check failed, please retry'));
		});
	},

	startSetup: function(version, installPath) {
		var self = this;
		var btn = oc.$('btn-setup');
		var logEl = oc.$('setup-log-content');
		var statusEl = oc.$('setup-log-status');

		btn.disabled = true;
		btn.textContent = _('⏳ Installing...');
		statusEl.innerHTML = '<span style="color:#7aa2f7;">' + _('⏳ Installation in progress...') + '</span>';
		logEl.textContent += '════════════════════════════════════════\n';
		logEl.textContent += _('📦 Install Runtime (') + ((version === 'stable') ? _('Stable') : _('Latest')) + ')\n';
		logEl.textContent += '════════════════════════════════════════\n';
		logEl.textContent += _('Install path: ') + installPath + '\n';
		logEl.textContent += _('Starting the installation...\n');

		this._autoScroll = oc.bindAutoScroll(logEl);
		this._autoScroll.forceBottom();
		this._lastLogLen = logEl.textContent.length;

		api.service.setup(version, installPath).then(function() {
			self.pollSetupLog();
		}).catch(function(e) {
			statusEl.innerHTML = '<span style="color:#cf222e;">' + _('❌ Failed to start the installation') + '</span>';
			btn.disabled = false;
			btn.textContent = _('📦 Install Runtime');
			alert(_('Failed to start the installation: ') + (e.message || e));
		});
	},

	pollSetupLog: function() {
		var self = this;
		var logEl = oc.$('setup-log-content');

		if (this._setupTimer)
			clearInterval(this._setupTimer);

		this._lastLogLen = 0;
		if (this._autoScroll)
			this._autoScroll.enable();

		this._setupTimer = setInterval(function() {
			api.setupLog().then(function(r) {
				if (r.log && r.log.length > self._lastLogLen) {
					var newLog = r.log.substring(self._lastLogLen);
					logEl.textContent += newLog;
					self._lastLogLen = r.log.length;
				}
				if (self._autoScroll)
					self._autoScroll.scroll();

				var statusEl = oc.$('setup-log-status');
				if (r.state === 'running')
					statusEl.innerHTML = '<span style="color:#7aa2f7;">' + _('⏳ Installation in progress...') + '</span>';
				else if (r.state === 'success') {
					clearInterval(self._setupTimer);
					self._setupTimer = null;
					self.setupDone(true, logEl.textContent);
				}
				else if (r.state === 'failed') {
					clearInterval(self._setupTimer);
					self._setupTimer = null;
					self.setupDone(false, logEl.textContent);
				}
			}).catch(function() {});
		}, 1500);
	},

	setupDone: function(ok, log) {
		var btn = oc.$('btn-setup');
		var statusEl = oc.$('setup-log-status');
		var resultEl = oc.$('setup-log-result');

		btn.disabled = false;
		btn.textContent = _('📦 Install Runtime');
		resultEl.style.display = 'block';

		if (ok) {
			statusEl.innerHTML = '<span style="color:#1a7f37;">' + _('✅ Installation complete') + '</span>';
			resultEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#1a7f37;font-size:14px;">' + _('🎉 Congratulations! The OpenClaw runtime was installed successfully!') + '</strong>' + '<br/>' +
				'<span style="color:#555;font-size:13px;line-height:1.8;">' + _('The service was enabled and started automatically — click the button below to reload the page and see the status.') + '</span>' + '<br/>' +
				'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-setup" style="margin-top:10px;">' + _('🔄 Reload Page') + '</button>' + '</div>';
			oc.$('btn-reload-after-setup').addEventListener('click', function() { location.reload(); });
		}
		else {
			statusEl.innerHTML = '<span style="color:#cf222e;">' + _('❌ Installation failed') + '</span>';
			var reasons = oc.analyzeFailure(log);
			resultEl.innerHTML = '<div style="border:1px solid #f5c6cb;background:#ffeef0;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#cf222e;font-size:14px;">' + _('❌ Installation failed') + '</strong>' + '<br/>' +
				'<div style="margin:8px 0;padding:10px 14px;background:#fff5f5;border-radius:4px;font-size:13px;line-height:1.8;">' +
				'<strong>' + _('🔍 Possible causes:') + '</strong>' + '<br/>' + reasons + '</div>' +
				'<div style="margin-top:8px;font-size:12px;color:#666;">' + _('💡 The full log is in the terminal output above; you can also view it with ') + '<code>' + 'cat /tmp/openclaw-setup.log' + '</code>' + '</div>' + '</div>';
		}
	},

	/* ── 普通服务操作 ── */
	serviceCtl: function(action) {
		var self = this;
		var el = oc.$('action-result');

		el.innerHTML = '<span style="color:#999">' + _('⏳ Working...') + '</span>';
		if (action === 'restart')
			api.service.restart().then(apply).catch(fail);
		else
			api.service.stop().then(apply).catch(fail);

		function apply(r) {
			if (r.status === 'ok')
				el.innerHTML = '<span style="color:green">✅ ' + action + _(' done') + '</span>';
			else
				el.innerHTML = '<span style="color:red">❌ ' + (r.message || _('Failed')) + '</span>';
			self.updateStatusOnceSoon();
		}
		function fail(e) {
			el.innerHTML = '<span style="color:red">' + _('❌ Error') + '</span>';
		}
	},

	updateStatusOnceSoon: function() {
		var self = this;
		setTimeout(function() {
			api.status().then(function(d) { self.renderStatus(d); }).catch(function() {});
		}, 2500);
	},

	/* ── 检测升级 ── */
	checkUpdate: function(silent) {
		var self = this;
		var btn = oc.$('btn-check-update');
		var el = oc.$('action-result');
		var act = oc.$('oc-update-action');
		var dot = oc.$('update-dot');

		if (!silent) {
			btn.disabled = true;
			btn.textContent = _('⏳ Checking...');
		}
		el.textContent = '';
		act.style.display = 'none';

		api.checkUpdate().then(function(r) {
			btn.disabled = false;
			btn.textContent = _('🔍 Check for Updates');
			if (dot)
				dot.style.display = 'none';

			if (silent) {
				if (r.plugin_has_update && dot)
					dot.style.display = 'block';
				return;
			}

			var msgs = [];
			if (r.plugin_current) {
				if (r.plugin_has_update)
					msgs.push('<span class="ver-badge-new">' + _('🔌 Plugin update available') + '</span>' + _(' v') + r.plugin_current + ' → <span class="ver-tag">v' + r.plugin_latest + '</span>');
				else if (r.plugin_latest)
					msgs.push('<span class="ver-badge-latest">' + _('🔌 Plugin up to date') + '</span>' + _(' v') + r.plugin_current);
				else
					msgs.push('<span class="ver-badge-unknown">' + _('🔌 Plugin check unavailable') + '</span>' + _(' v') + r.plugin_current);
			}
			if (r.openclaw_current) {
				if (r.openclaw_has_update)
					msgs.push('<span class="ver-badge-new">' + _('🦞 Core update available') + '</span>' + _(' v') + r.openclaw_current + ' → <span class="ver-tag">v' + r.openclaw_latest + '</span>');
				else if (r.openclaw_latest)
					msgs.push('<span class="ver-badge-latest">' + _('🦞 Core up to date') + '</span>' + _(' v') + r.openclaw_current);
				else
					msgs.push('<span class="ver-badge-unknown">' + _('🦞 Core check unavailable') + '</span>' + _(' v') + r.openclaw_current);
			}
			if (msgs.length === 0)
				msgs.push('<span class="ver-badge-unknown">' + _('Unable to get version info') + '</span>');

			el.innerHTML = msgs.join('<br/>');

			if (r.plugin_has_update || r.openclaw_has_update) {
				act.style.display = 'block';
				self._pluginLatestVer = r.plugin_latest;
				self._coreLatestVer = r.openclaw_latest;

				var notesHtml = '';
				if (r.plugin_has_update && r.release_notes)
					notesHtml = '<div style="margin:12px 0;border:1px solid #d0d7de;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">' +
						'<div style="background:linear-gradient(135deg,#f6f8fa 0%,#ffffff 100%);padding:12px 16px;border-bottom:1px solid #d0d7de;display:flex;align-items:center;justify-content:space-between;">' +
						'<span style="font-size:14px;font-weight:600;color:#24292f;">' + _('📋 Plugin Changelog') + '</span>' +
						'<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%);color:#1565c0;border:1px solid #64b5f6;">v' + r.plugin_latest + '</span></div>' +
						'<div style="padding:16px;max-height:450px;overflow-y:auto;background:#fff;">' + oc.markdownToHtml(r.release_notes) + '</div></div>';

				var actBtns = '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">';
				if (r.plugin_has_update)
					actBtns += '<button class="btn cbi-button cbi-button-apply" type="button" id="btn-plugin-upgrade" style="box-shadow:0 2px 4px rgba(0,0,0,0.1);">' + _('⬆️ Upgrade Plugin Now (v') + r.plugin_latest + ')</button>' +
						'<a href="https://github.com/10000ge10000/luci-app-openclaw/releases/latest" target="_blank" rel="noopener" class="btn cbi-button cbi-button-action" style="text-decoration:none;">' + _('📥 Download from GitHub') + '</a>';
				if (r.openclaw_has_update)
					actBtns += '<button class="btn cbi-button cbi-button-apply" type="button" id="btn-core-upgrade" style="background:#d97706;border-color:#b45309;color:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);">' + _('⬆️ Upgrade OpenClaw Core Now (v') + r.openclaw_latest + ')</button>';
				actBtns += '</div>';

				act.innerHTML = notesHtml + actBtns;

				var b1 = oc.$('btn-plugin-upgrade');
				if (b1)
					b1.addEventListener('click', function() { self.pluginUpgrade(); });
				var b2 = oc.$('btn-core-upgrade');
				if (b2)
					b2.addEventListener('click', function() { self.coreUpgrade(); });
			}
		}).catch(function(e) {
			btn.disabled = false;
			btn.textContent = _('🔍 Check for Updates');
			if (!silent)
				el.innerHTML = '<span style="color:red">' + _('❌ Check failed') + '</span>';
		});
	},

	/* silent red-dot on page load (2s delay, original behavior) */
	startUpdateDotCheck: function() {
		var self = this;
		setTimeout(function() {
			self.checkUpdate(true);
		}, 2000);
	},

	/* 核心升级 */
	coreUpgrade: function() {
		var self = this;
		var ver = this._coreLatestVer || '2026.9.1';

		if (!confirm(_('Upgrade the OpenClaw core to v') + ver + _('?\n\nThe upgrade runs a safe transaction: automatic full-state backup, SQLite database precheck and smooth configuration migration.')))
			return;

		var btn = oc.$('btn-core-upgrade');
		var panel = oc.$('setup-log-panel');
		var logEl = oc.$('setup-log-content');
		var titleEl = oc.$('setup-log-title');
		var statusEl = oc.$('setup-log-status');
		var resultEl = oc.$('setup-log-result');

		if (btn) {
			btn.disabled = true;
			btn.textContent = _('⏳ Starting the core upgrade...');
		}
		panel.style.display = 'block';
		logEl.textContent = _('Starting the OpenClaw core upgrade transaction...\n');
		titleEl.textContent = _('📋 OpenClaw Core Upgrade Log');
		statusEl.innerHTML = '<span style="color:#7aa2f7;">' + _('⏳ Core upgrade in progress (state-machine transaction)...') + '</span>';
		resultEl.style.display = 'none';

		this._autoScroll = oc.bindAutoScroll(logEl);
		this._autoScroll.forceBottom();

		api.service.coreUpgrade(ver).then(function() {
			self.pollSetupLog();
		}).catch(function(e) {
			statusEl.innerHTML = '<span style="color:#cf222e;">' + _('❌ Failed to start the upgrade') + '</span>';
			alert(_('Failed to start the core upgrade: ') + (e.message || e));
		});
	},

	/* 插件一键升级 */
	pluginUpgrade: function() {
		var self = this;
		var ver = this._pluginLatestVer;

		if (!ver) {
			alert(_('Could not determine the latest version'));
			return;
		}
		if (!confirm(_('Upgrade the plugin to v') + ver + _('?\n\nThe upgrade replaces the plugin files and clears the LuCI cache; the running OpenClaw service is not affected.')))
			return;

		var btn = oc.$('btn-plugin-upgrade');
		var panel = oc.$('setup-log-panel');
		var logEl = oc.$('setup-log-content');
		var titleEl = oc.$('setup-log-title');
		var statusEl = oc.$('setup-log-status');
		var resultEl = oc.$('setup-log-result');

		btn.disabled = true;
		btn.textContent = _('⏳ Upgrading the plugin...');
		panel.style.display = 'block';
		logEl.textContent = _('Starting the plugin upgrade...\n');
		titleEl.textContent = _('📋 Plugin Upgrade Log');
		statusEl.innerHTML = '<span style="color:#7aa2f7;">' + _('⏳ Plugin upgrade in progress...') + '</span>';
		resultEl.style.display = 'none';

		this._autoScroll = oc.bindAutoScroll(logEl);
		this._autoScroll.forceBottom();

		api.pluginUpgrade(ver).then(function() {
			self.pollPluginUpgradeLog();
		}).catch(function(e) {
			statusEl.innerHTML = '<span style="color:#cf222e;">' + _('❌ Failed to start the upgrade') + '</span>';
			alert(_('Failed to start the plugin upgrade: ') + (e.message || e));
		});
	},

	pollPluginUpgradeLog: function() {
		var self = this;
		var logEl = oc.$('setup-log-content');
		var statusEl = oc.$('setup-log-status');

		if (this._pluginUpgradeTimer)
			clearInterval(this._pluginUpgradeTimer);

		this._pollErrors = 0;
		if (this._autoScroll)
			this._autoScroll.enable();

		this._pluginUpgradeTimer = setInterval(function() {
			api.pluginUpgradeLog().then(function(r) {
				self._pollErrors = 0;
				if (r.log)
					logEl.textContent = r.log;
				if (self._autoScroll)
					self._autoScroll.scroll();
				if (r.state === 'running')
					statusEl.innerHTML = '<span style="color:#7aa2f7;">' + _('⏳ Plugin upgrade in progress...') + '</span>';
				else if (r.state === 'success') {
					clearInterval(self._pluginUpgradeTimer);
					self._pluginUpgradeTimer = null;
					self.pluginUpgradeDone(true);
				}
				else if (r.state === 'failed') {
					clearInterval(self._pluginUpgradeTimer);
					self._pluginUpgradeTimer = null;
					self.pluginUpgradeDone(false);
				}
			}).catch(function(e) {
				self._pollErrors++;
				if (self._pollErrors >= 8) {
					clearInterval(self._pluginUpgradeTimer);
					self._pluginUpgradeTimer = null;
					self.pluginUpgradeDone(true);
				}
			});
		}, 2000);
	},

	pluginUpgradeDone: function(ok) {
		var btn = oc.$('btn-plugin-upgrade');
		var statusEl = oc.$('setup-log-status');
		var resultEl = oc.$('setup-log-result');

		if (btn) {
			btn.disabled = false;
			btn.textContent = _('⬆️ Upgrade Plugin');
		}
		resultEl.style.display = 'block';

		if (ok) {
			statusEl.innerHTML = '<span style="color:#1a7f37;">' + _('✅ Plugin upgrade complete') + '</span>';
			resultEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#1a7f37;font-size:14px;">' + _('🎉 Plugin upgrade successful!') + '</strong>' + '<br/>' +
				'<span style="color:#555;font-size:13px;line-height:1.8;">' + _('The plugin files were updated; the OpenClaw service is unaffected. Reload the page to load the new UI.') + '</span>' + '<br/>' +
				'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-plugin" style="margin-top:10px;">' + _('🔄 Reload Page') + '</button>' + '</div>';
			oc.$('btn-reload-after-plugin').addEventListener('click', function() { location.reload(); });
		}
		else {
			statusEl.innerHTML = '<span style="color:#cf222e;">' + _('❌ Plugin upgrade failed') + '</span>';
			resultEl.innerHTML = '<div style="border:1px solid #f5c6cb;background:#ffeef0;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#cf222e;font-size:14px;">' + _('❌ Plugin upgrade failed') + '</strong>' + '<br/>' +
				'<span style="color:#555;font-size:13px;">' + _('See the log above for details, or run ') + '<code>' + 'cat /tmp/openclaw-plugin-upgrade.log' + '</code>' + '</span>' + '<br/>' +
				'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-plugin-fail" style="margin-top:10px;">' + _('🔄 Reload Page') + '</button>' + '</div>';
			oc.$('btn-reload-after-plugin-fail').addEventListener('click', function() { location.reload(); });
		}
	},

	/* ── 卸载运行环境 ── */
	doUninstall: function() {
		var self = this;

		if (!confirm(_('Uninstall the OpenClaw runtime?\n\nNode.js, the OpenClaw program and its configuration data will be deleted and the service stopped.\n\nThis plugin itself is kept — you can reinstall the runtime later.')))
			return;

		var btn = oc.$('btn-uninstall');
		var el = oc.$('action-result');

		btn.disabled = true;
		btn.textContent = _('⏳ Uninstalling...');
		el.innerHTML = '<span style="color:#999">' + _('Stopping the service and cleaning up files...') + '</span>';

		api.uninstall().then(function(r) {
			btn.disabled = false;
			btn.textContent = _('🗑️ Uninstall');
			if (r.status === 'ok') {
				el.innerHTML = '<div style="border:1px solid #d0d7de;background:#f6f8fa;padding:12px 16px;border-radius:6px;">' +
					'<strong style="color:#1a7f37;">' + _('✅ Uninstall complete') + '</strong>' + '<br/>' +
					'<span style="color:#555;font-size:13px;">' + r.message + '</span><br/>' +
					'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-uninstall" style="margin-top:8px;">' + _('🔄 Reload Page') + '</button>' + '</div>';
				oc.$('btn-reload-after-uninstall').addEventListener('click', function() { location.reload(); });
			}
			else {
				el.innerHTML = '<span style="color:red">❌ ' + (r.message || _('Uninstall failed')) + '</span>';
			}
		}).catch(function(e) {
			btn.disabled = false;
			btn.textContent = _('🗑️ Uninstall');
			el.innerHTML = '<span style="color:red">' + _('❌ Request failed') + '</span>';
		});
	},

	/* ── 备份 / 恢复 ── */
	openBackupDialog: function() {
		var dlg = oc.$('oc-backup-dialog');
		dlg.style.display = 'flex';
		oc.$('oc-backup-result').style.display = 'none';
		this.loadBackupList();
	},

	loadBackupList: function() {
		var el = oc.$('oc-backup-list');
		var self = this;

		el.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">' + _('⏳ Loading backup list...') + '</div>';

		api.backup('list', '', '').then(function(r) {
			if (r.status === 'ok' && r.backups && r.backups.length > 0) {
				var h = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
				h += '<tr style="background:#f6f8fa;border-bottom:2px solid #d0d7de;">' +
					'<th style="padding:6px 8px;text-align:left;">' + _('Type') + '</th>' +
					'<th style="padding:6px 8px;text-align:left;">' + _('Backup Time') + '</th>' +
					'<th style="padding:6px 8px;text-align:right;">' + _('Size') + '</th>' +
					'<th style="padding:6px 8px;text-align:center;">' + _('Action') + '</th>' + '</tr>';

				for (var i = 0; i < r.backups.length; i++) {
					var b = r.backups[i];
					var typeBadge = (b.backup_type === 'config')
						? '<span style="background:#ddf4ff;color:#0969da;padding:2px 6px;border-radius:3px;font-size:11px;white-space:nowrap;">' + _('📄 Config Only') + '</span>'
						: '<span style="background:#fff8c5;color:#9a6700;padding:2px 6px;border-radius:3px;font-size:11px;white-space:nowrap;">' + _('📦 Full Backup') + '</span>';
					var rowBg = (i % 2 === 0) ? '#fff' : '#f6f8fa';
					h += '<tr style="border-bottom:1px solid #eee;background:' + rowBg + ';">' +
						'<td style="padding:7px 8px;">' + typeBadge + '</td>' +
						'<td style="padding:7px 8px;color:#555;white-space:nowrap;">' + oc.escapeHtml(b.time) + '</td>' +
						'<td style="padding:7px 8px;text-align:right;color:#666;white-space:nowrap;">' + oc.escapeHtml(b.size_str) + '</td>' +
						'<td style="padding:5px 8px;text-align:center;white-space:nowrap;">' +
						'<button class="btn cbi-button cbi-button-action" style="font-size:11px;padding:1px 8px;margin-right:4px;" data-act="restore" data-file="' + oc.escapeHtml(b.filename) + '">' + _('Restore') + '</button>' +
						'<button class="btn cbi-button cbi-button-remove" style="font-size:11px;padding:1px 8px;" data-act="delete" data-file="' + oc.escapeHtml(b.filename) + '">' + _('Delete') + '</button>' +
						'</td></tr>';
				}
				h += '</table>';
				el.innerHTML = h;

				var btns = el.querySelectorAll('button[data-act]');
				for (var j = 0; j < btns.length; j++) {
					btns[j].addEventListener('click', function() {
						var act = this.getAttribute('data-act');
						var file = this.getAttribute('data-file');
						if (act === 'restore')
							self.restoreBackup(file);
						else
							self.deleteBackup(file);
					});
				}
			}
			else if (r.status === 'ok') {
				el.innerHTML = '<div style="color:#888;font-size:12px;padding:8px;text-align:center;">' + _('No backups yet — create one first') + '</div>';
			}
			else {
				el.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">⚠️ ' + (r.message || _('Failed to load the list')) + '</div>';
			}
		}).catch(function(e) {
			el.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">' + _('⚠️ Could not load the list') + '</div>';
		});
	},

	doBackup: function(onlyConfig) {
		var resEl = oc.$('oc-backup-result');
		var btnC = oc.$('btn-bk-config');
		var btnF = oc.$('btn-bk-full');

		btnC.disabled = true;
		btnF.disabled = true;
		resEl.style.display = 'block';
		resEl.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">' + _('⏳ Creating backup...') +
			(onlyConfig ? _(' (config only)') : _(' (full backup — this may take a while)')) + '</div>';

		api.backup('create', onlyConfig ? '1' : '0', '').then(function(r) {
			btnC.disabled = false;
			btnF.disabled = false;
			if (r.status === 'ok') {
				resEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:10px 14px;border-radius:6px;font-size:12px;">' +
					'<strong style="color:#1a7f37;">' + _('✅ Backup complete') + '</strong>' + '</div>';
				this_loadBackupList();
			}
			else {
				resEl.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">⚠️ ' + (r.message || _('Backup failed')) + '</div>';
			}
			this_loadBackupList();
		}).catch(function(e) {
			btnC.disabled = false;
			btnF.disabled = false;
			resEl.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">' + _('⚠️ Backups require OpenClaw v2026.3.8+') + '</div>';
		});

		var self = this;
		function this_loadBackupList() {
			self.loadBackupList();
		}
	},

	restoreBackup: function(filename) {
		var self = this;

		if (!confirm(_('Restore the configuration from this backup?\n\n') + filename + _('\n\nThe current openclaw.json will be overwritten with the backed-up version and the service will restart.')))
			return;

		var resEl = oc.$('oc-backup-result');
		resEl.style.display = 'block';
		resEl.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">' + _('⏳ Restoring configuration...') + '</div>';

		api.backup('restore', '', filename).then(function(r) {
			if (r.status === 'ok') {
				resEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:10px 14px;border-radius:6px;font-size:12px;">' +
					'<strong style="color:#1a7f37;">' + _('✅ Configuration restored') + '</strong>' + '<br/>' +
					'<span style="color:#555;">' + r.message + '</span><br/>' +
					'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-restore" style="margin-top:6px;font-size:12px;">' + _('🔄 Reload Page') + '</button>' + '</div>';
				oc.$('btn-reload-after-restore').addEventListener('click', function() { location.reload(); });
			}
			else {
				resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">❌ ' + (r.message || _('Restore failed')) + '</div>';
			}
		}).catch(function(e) {
			resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">' + _('❌ Restore failed — check the log') + '</div>';
		});
	},

	deleteBackup: function(filename) {
		var self = this;

		if (!confirm(_('Delete this backup?\n\n') + filename + _('\n\nThis cannot be undone.')))
			return;

		var resEl = oc.$('oc-backup-result');
		resEl.style.display = 'block';
		resEl.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">' + _('⏳ Deleting...') + '</div>';

		api.backup('delete', '', filename).then(function(r) {
			if (r.status === 'ok') {
				resEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:10px 14px;border-radius:6px;font-size:12px;">' +
					'<strong style="color:#1a7f37;">✅ ' + r.message + '</strong></div>';
			}
			else {
				resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">❌ ' + (r.message || _('Delete failed')) + '</div>';
			}
			self.loadBackupList();
		}).catch(function(e) {
			resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">' + _('❌ Delete failed') + '</div>';
		});
	}
});
