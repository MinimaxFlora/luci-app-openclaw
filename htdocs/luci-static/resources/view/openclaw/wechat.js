'use strict';
'require view';
'require dom';

const api = require('openclaw.api');
const oc = require('openclaw.common');

/*
 * 微信渠道配置 (迁移自 luasrc/view/openclaw/wechat.htm)
 *
 * 状态检测 / 插件安装 / 升级检测与升级 / 扫码登录 / 退出账号 / 卸载,
 * 全部经由 openclaw.api (ubus) 调用, UI 结构、文案、对话框 1:1 保留。
 */
return view.extend({
	render: function() {
		const style = [
			'.oc-page-header{margin:0 0 16px 0;}',
			'.oc-page-header h2{font-size:18px;font-weight:600;color:#333;margin:0 0 6px 0;}',
			'.oc-page-header p{font-size:13px;color:#666;margin:0;line-height:1.6;}',
			'.oc-prereq-box{background:#fff8c5;border:1px solid #d29922;border-radius:8px;padding:14px 18px;margin-bottom:16px;}',
			'.oc-prereq-box h3{margin:0 0 10px 0;font-size:14px;color:#9a6700;}',
			'.oc-prereq-box ol{margin:0;padding-left:20px;}',
			'.oc-prereq-box li{margin:6px 0;font-size:13px;color:#555;line-height:1.6;}',
			'.oc-prereq-box code{background:#fff;padding:2px 6px;border-radius:4px;font-size:12px;color:#333;border:1px solid #e0e0e0;}',
			'.oc-prereq-box .warning{background:#ffeef0;border:1px solid #cf222e;color:#cf222e;padding:8px 12px;border-radius:6px;margin-top:12px;font-size:12px;}',
			'.oc-status-box{background:#f6f8fa;border:1px solid #d0d7de;border-radius:8px;padding:14px 18px;margin-bottom:16px;}',
			'.oc-status-box h3{margin:0 0 12px 0;font-size:14px;color:#333;}',
			'.oc-status-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e1e4e8;}',
			'.oc-status-row:last-child{border-bottom:none;}',
			'.oc-status-label{font-size:13px;color:#666;}',
			'.oc-status-value{font-size:13px;font-weight:500;}',
			'.oc-status-value.ok{color:#1a7f37;}',
			'.oc-status-value.warn{color:#9a6700;}',
			'.oc-status-value.error{color:#cf222e;}',
			'.oc-action-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;}',
			'.oc-modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;}',
			'.oc-modal-overlay.show{display:flex;}',
			'.oc-modal{background:#fff;border-radius:12px;padding:24px;max-width:500px;width:90%;max-height:80vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.15);}',
			'.oc-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}',
			'.oc-modal-header h3{margin:0;font-size:16px;font-weight:600;color:#333;}',
			'.oc-modal-close{background:none;border:none;font-size:20px;color:#666;cursor:pointer;padding:0;line-height:1;}',
			'.oc-modal-close:hover{color:#333;}',
			'.oc-modal-body{margin-bottom:16px;}',
			'.oc-progress-box{background:#f6f8fa;border:1px solid #d0d7de;border-radius:8px;padding:12px;margin-bottom:12px;}',
			'.oc-progress-box pre{margin:0;font-size:12px;color:#333;white-space:pre;word-break:normal;max-height:300px;overflow-y:auto;overflow-x:auto;font-family:Consolas,Monaco,\'Courier New\',monospace;line-height:12px;letter-spacing:0;}',
			'.oc-progress-spinner{display:inline-block;width:16px;height:16px;border:2px solid #e0e0e0;border-top-color:#4a90d9;border-radius:50%;animation:oc-spin 0.8s linear infinite;margin-right:8px;vertical-align:middle;}',
			'@keyframes oc-spin{to{transform:rotate(360deg);}}',
			'.oc-result-success{background:#e6f7e9;border:1px solid #1a7f37;border-radius:8px;padding:12px;color:#1a7f37;text-align:center;}',
			'.oc-result-error{background:#ffeef0;border:1px solid #cf222e;border-radius:8px;padding:12px;color:#cf222e;text-align:center;}',
			'.oc-result-info{background:#ddf4ff;border:1px solid #0969da;border-radius:8px;padding:12px;color:#0969da;text-align:center;}',
			'.oc-qrcode-box{text-align:center;padding:20px;}',
			'.oc-qrcode-box img{max-width:256px;border:1px solid #e0e0e0;border-radius:8px;}',
			'.oc-qrcode-box p{margin:12px 0 0 0;font-size:13px;color:#666;}',
			'.oc-qrcode-ascii{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:16px;margin:12px 0;overflow-x:auto;text-align:left;}',
			'.oc-qrcode-ascii pre{font-family:\'Courier New\',Consolas,monospace;font-size:6px;line-height:6px;margin:0;white-space:pre;letter-spacing:0;color:#000;}',
			'.oc-qrcode-link-btn{display:inline-block;background:#1a7f37;color:#fff !important;padding:14px 28px;border-radius:8px;text-decoration:none !important;font-size:15px;font-weight:600;margin:16px 0;transition:all 0.2s;cursor:pointer;border:none;box-shadow:0 2px 8px rgba(26,127,55,0.3);}',
			'.oc-qrcode-link-btn:hover{background:#1a6330;color:#fff !important;text-decoration:none !important;transform:translateY(-1px);box-shadow:0 4px 12px rgba(26,127,55,0.4);}',
			'.oc-qrcode-link-btn:visited{color:#fff !important;}',
			'.oc-copy-btn{display:inline-block;background:#f6f8fa;color:#333;padding:6px 12px;border-radius:4px;font-size:12px;cursor:pointer;border:1px solid #d0d7de;margin-left:8px;transition:all 0.2s;}',
			'.oc-copy-btn:hover{background:#f3f4f6;border-color:#1a7f37;color:#1a7f37;}',
			'.oc-copy-btn.copied{background:#e6f7e9;border-color:#1a7f37;color:#1a7f37;}',
			'.oc-qrcode-copy-link{font-size:12px;color:#666;margin-top:12px;word-break:break-all;line-height:1.6;}',
			'.oc-qrcode-copy-link code{background:#f6f8fa;padding:2px 6px;border-radius:4px;font-size:11px;border:1px solid #e1e4e8;}',
			'.oc-error-detail{margin:10px 0 0 0;font-size:12px;line-height:1.5;text-align:left;white-space:pre-wrap;word-break:break-all;background:#fff;padding:10px;border-radius:4px;max-height:240px;overflow-y:auto;}'
		].join('\n');

		const html =
			'<style>' + style + '</style>' +
			'<div class="oc-page-header">' +
			'<h2>' + _('💬 WeChat Channel') + '</h2>' +
			'<p>' + _('Connect WeChat through the ClawBot plugin and chat privately with your AI assistant. Multiple accounts can be online at the same time.') + '</p>' +
			'</div>' +
			'<div class="oc-prereq-box">' +
			'<h3>' + _('📋 Prerequisites') + '</h3>' +
			'<ol>' +
			'<li>' + '<strong>' + _('Install / reinstall the WeChat plugin first') + '</strong>' + _(' — the page automatically checks Node, python3, directory permissions and WeChat API reachability') + '</li>' +
			'<li>' + '<strong>' + _('Click “Log in”') + '</strong>' + _(' — open the link that appears, then scan it with the WeChat scanner') + '</li>' +
			'<li>' + '<strong>' + _('Wait for the success notice') + '</strong>' + _(' — the gateway then reloads the WeChat account; verify by sending it a message from WeChat') + '</li>' +
			'</ol>' +
			'<div class="warning">' + _('⚠️ Common failure causes: expired QR code, account risk control, TLS/timeout between the router and ilinkai.weixin.qq.com, missing plugin registration, wrong data directory permissions. On failure the recent log is shown.') + '</div>' +
			'</div>' +
			'<div class="oc-status-box">' +
			'<h3>' + _('📊 Plugin Status') + '</h3>' +
			'<div class="oc-status-row">' + '<span class="oc-status-label">' + _('WeChat Plugin') + '</span>' + '<span class="oc-status-value" id="oc-wechat-plugin">' + _('Detecting...') + '</span>' + '</div>' +
			'<div class="oc-status-row">' + '<span class="oc-status-label">' + _('Plugin Version') + '</span>' + '<span class="oc-status-value" id="oc-wechat-plugin-ver">' + '—' + '</span>' + '</div>' +
			'<div class="oc-status-row" id="oc-wechat-accounts-row" style="flex-direction:column;align-items:flex-start;">' +
			'<div style="display:flex;justify-content:space-between;width:100%;">' +
			'<span class="oc-status-label" style="align-self:center;">' + _('Login Status') + '</span>' +
			'<span class="oc-status-value" id="oc-wechat-login">' + _('Detecting...') + '</span>' +
			'</div>' +
			'<div id="oc-wechat-accounts-list" style="width:100%;margin-top:10px;display:none;"></div>' +
			'</div>' +
			'<div class="oc-status-row">' + '<span class="oc-status-label">' + _('OpenClaw Version') + '</span>' + '<span class="oc-status-value" id="oc-wechat-ocver">' + _('Detecting...') + '</span>' + '</div>' +
			'</div>' +
			'<div class="oc-action-bar">' +
			'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-install-plugin">' + _('📦 Install WeChat Plugin') + '</button>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-upgrade-plugin">' + _('🔍 Check for Upgrades') + '</button>' +
			'<button class="btn cbi-button" type="button" id="btn-refresh-status">' + _('🔄 Refresh Status') + '</button>' +
			'<button class="btn cbi-button" type="button" id="btn-uninstall-plugin" style="background:#ffeef0;color:#cf222e;border-color:#cf222e;">' + _('🗑️ Uninstall Plugin') + '</button>' +
			'</div>' +
			/* 安装进度对话框 */
			'<div class="oc-modal-overlay" id="oc-install-modal">' +
			'<div class="oc-modal">' +
			'<div class="oc-modal-header">' + '<h3 id="oc-install-title">' + _('📦 Install WeChat Plugin') + '</h3>' + '<button class="oc-modal-close" type="button" data-close="oc-install-modal">' + '&times;' + '</button>' + '</div>' +
			'<div class="oc-modal-body">' +
			'<div id="oc-install-progress">' + '<div class="oc-progress-box">' + '<span class="oc-progress-spinner">' + '</span>' + '<span>' + _('Installing, please wait...') + '</span>' + '</div>' + '<pre id="oc-install-log">' + '</pre>' + '<div id="oc-install-qrcode-link" style="display:none;margin:10px 0;text-align:center;">' + '</div>' + '</div>' +
			'<div id="oc-install-result" style="display:none;"></div>' +
			'</div></div></div>' +
			/* 登录二维码对话框 */
			'<div class="oc-modal-overlay" id="oc-login-modal">' +
			'<div class="oc-modal">' +
			'<div class="oc-modal-header">' + '<h3>' + _('📱 WeChat QR Login') + '</h3>' + '<button class="oc-modal-close" type="button" data-close="oc-login-modal">' + '&times;' + '</button>' + '</div>' +
			'<div class="oc-modal-body">' +
			'<div id="oc-login-progress">' + '<div class="oc-progress-box">' + '<span class="oc-progress-spinner">' + '</span>' + '<span>' + _('Fetching the login QR code...') + '</span>' + '</div>' + '</div>' +
			'<div id="oc-login-qrcode" style="display:none;"></div>' +
			'<div id="oc-login-result" style="display:none;"></div>' +
			'</div></div></div>' +
			/* 升级检测对话框 */
			'<div class="oc-modal-overlay" id="oc-upgrade-modal">' +
			'<div class="oc-modal">' +
			'<div class="oc-modal-header">' + '<h3>' + _('🔍 Check Plugin Upgrade') + '</h3>' + '<button class="oc-modal-close" type="button" data-close="oc-upgrade-modal">' + '&times;' + '</button>' + '</div>' +
			'<div class="oc-modal-body">' +
			'<div id="oc-upgrade-progress">' + '<div class="oc-progress-box">' + '<span class="oc-progress-spinner">' + '</span>' + '<span>' + _('Checking for updates...') + '</span>' + '</div>' + '</div>' +
			'<div id="oc-upgrade-result" style="display:none;"></div>' +
			'</div></div></div>';

		const root = E('div', { 'id': 'oc-wechat-page' });

		root.innerHTML = html;

		this.initPage();

		return root;
	},

	/* state + DOM wiring; runs after render() so all nodes exist */
	initPage: function() {
		var self = this;

		this.installPollTimer = null;
		this.loginPollTimer = null;
		this.upgradePollTimer = null;
		this.pluginInstalled = false;

		oc.$('btn-install-plugin').addEventListener('click', function() { self.installWechatPlugin(); });
		oc.$('btn-upgrade-plugin').addEventListener('click', function() { self.checkUpgradeWechat(); });
		oc.$('btn-refresh-status').addEventListener('click', function() { self.refreshWechatStatus(); });
		oc.$('btn-uninstall-plugin').addEventListener('click', function() { self.uninstallWechatPlugin(); });

		/* modal close buttons */
		var closes = document.querySelectorAll('[data-close]');
		for (var i = 0; i < closes.length; i++) {
			closes[i].addEventListener('click', function() {
				var id = this.getAttribute('data-close');
				if (id === 'oc-install-modal')
					self.closeInstallModal();
				else if (id === 'oc-login-modal')
					self.closeLoginModal();
				else if (id === 'oc-upgrade-modal')
					self.closeUpgradeModal();
			});
		}

		this.refreshWechatStatus();
	},

	load: function() {
		return Promise.resolve();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	/* ── 状态刷新 ── */
	refreshWechatStatus: function() {
		var self = this;

		api.status().then(function(d) {
			var verEl = oc.$('oc-wechat-ocver');
			if (d.oc_version) {
				verEl.textContent = 'v' + d.oc_version;
				verEl.className = 'oc-status-value ok';
				if (d.oc_version >= '2026.3.22') {
					verEl.textContent += _(' ✓ compatible');
				}
				else {
					verEl.textContent += _(' ⚠️ upgrade to 2026.3.22+ required');
					verEl.className = 'oc-status-value warn';
				}
			}
			else {
				verEl.textContent = _('Not installed');
				verEl.className = 'oc-status-value error';
			}
		}).catch(function() {});

		api.wechatStatus().then(function(d) {
			var pluginEl = oc.$('oc-wechat-plugin');
			var pluginVerEl = oc.$('oc-wechat-plugin-ver');
			var loginEl = oc.$('oc-wechat-login');
			var btnInstall = oc.$('btn-install-plugin');
			var btnUpgrade = oc.$('btn-upgrade-plugin');
			var accList = oc.$('oc-wechat-accounts-list');

			self.pluginInstalled = d.plugin_installed;

			if (d.plugin_installed) {
				pluginEl.textContent = _('✅ Installed');
				pluginEl.className = 'oc-status-value ok';
				btnInstall.textContent = _('📦 Reinstall Plugin');
				btnUpgrade.disabled = false;
				if (d.plugin_version)
					pluginVerEl.textContent = 'v' + d.plugin_version;
				else
					pluginVerEl.textContent = _('Installed');
			}
			else {
				pluginEl.textContent = _('❌ Not installed');
				pluginEl.className = 'oc-status-value error';
				btnInstall.textContent = _('📦 Install WeChat Plugin');
				btnUpgrade.disabled = true;
				pluginVerEl.textContent = '—';
			}

			if (d.logged_in && d.accounts && d.accounts.length > 0) {
				loginEl.textContent = _('✅ Logged in (') + d.accounts.length + _(' accounts)');
				loginEl.className = 'oc-status-value ok';

				var accHtml = '<ul style="list-style:none;padding:0;margin:0;border-top:1px dashed #eee;padding-top:10px;">';
				for (var i = 0; i < d.accounts.length; i++) {
					accHtml += '<li style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:6px;background:#fafafa;border-radius:4px;">' +
						'<span style="font-size:13px;color:#555;">👤 ' + oc.escapeHtml(d.accounts[i].name) + '</span>' +
						'<button class="oc-copy-btn" style="color:#cf222e;border-color:#cf222e;" data-oc-logout="' + oc.escapeHtml(d.accounts[i].name) + '">' + _('Log out') + '</button>' +
						'</li>';
				}
				accHtml += '</ul>' + '<div style="text-align:right;margin-top:8px;">' + '<button class="btn cbi-button" type="button" data-oc-login-qrcode>' + _('➕ Add New Account') + '</button>' + '</div>';

				accList.innerHTML = accHtml;
				accList.style.display = 'block';
			}
			else if (d.plugin_installed) {
				loginEl.textContent = _('⚠️ Not logged in');
				loginEl.className = 'oc-status-value warn';
				accList.innerHTML = '<div style="text-align:right;margin-top:8px;">' + '<button class="btn cbi-button" type="button" data-oc-login-qrcode>' + _('Log in') + '</button>' + '</div>';
				accList.style.display = 'block';
			}
			else {
				loginEl.textContent = '—';
				loginEl.className = 'oc-status-value';
				accList.style.display = 'none';
			}

			self.wireAccountButtons(accList);
		}).catch(function(e) {
			oc.$('oc-wechat-plugin').textContent = _('Check failed');
			oc.$('oc-wechat-login').textContent = _('Check failed');
		});
	},

	wireAccountButtons: function(scope) {
		var self = this;
		var btns;

		btns = scope.querySelectorAll('[data-oc-logout]');
		for (var i = 0; i < btns.length; i++) {
			btns[i].addEventListener('click', function() {
				var account = this.getAttribute('data-oc-logout');
				self.logoutWechatAccount(account, this);
			});
		}
		btns = scope.querySelectorAll('[data-oc-login-qrcode]');
		for (var j = 0; j < btns.length; j++) {
			btns[j].addEventListener('click', function() {
				self.showLoginQRCode();
			});
		}
	},

	/* ── 安装微信插件 ── */
	installWechatPlugin: function() {
		var self = this;
		var btn = oc.$('btn-install-plugin');

		btn.disabled = true;
		btn.textContent = _('⏳ Installing...');

		oc.$('oc-install-modal').classList.add('show');
		oc.$('oc-install-title').textContent = _('📦 Install WeChat Plugin');
		oc.$('oc-install-progress').style.display = 'block';
		oc.$('oc-install-result').style.display = 'none';
		oc.$('oc-install-log').textContent = _('Starting the installation...\n');

		api.wechatInstall().then(function(d) {
			if (d.status === 'ok')
				self.pollInstallLog(false);
			else
				self.showInstallError(d.message || _('Failed to start the installation'));
		}).catch(function(e) {
			self.showInstallError(_('Failed to start the installation: ') + e.message);
		});
	},

	/* 轮询安装日志 (autoShowQRCode=false 表示安装完成不自动弹登录) */
	pollInstallLog: function(autoShowQRCode) {
		var self = this;

		if (this.installPollTimer)
			clearTimeout(this.installPollTimer);

		api.wechatInstallLog().then(function(d) {
			var logEl = oc.$('oc-install-log');

			if (d.log) {
				var cleanLog = d.log.replace(/\x1b\[[0-9;]*m/g, '');
				cleanLog = cleanLog.replace(/\[openclaw-weixin\] /g, '');

				var linkUrl = oc.extractWechatLoginUrl(cleanLog);
				if (linkUrl) {
					var linkContainer = oc.$('oc-install-qrcode-link');
					linkContainer.style.display = 'block';
					linkContainer.innerHTML = '<a href="' + oc.escapeHtml(linkUrl) + '" target="_blank" rel="noopener noreferrer" class="oc-qrcode-link-btn" style="padding:10px 20px;font-size:14px;margin:0;">' + _('🔗 Open the link, then scan it with WeChat') + '</a>';
				}

				logEl.textContent = cleanLog;
			}
			else {
				logEl.textContent = _('Waiting for output...');
			}

			logEl.scrollTop = logEl.scrollHeight;

			if (d.running) {
				self.installPollTimer = setTimeout(function() { self.pollInstallLog(autoShowQRCode); }, 1500);
			}
			else if (d.state === 'success') {
				self.showInstallSuccess(autoShowQRCode);
			}
			else if (d.state === 'failed') {
				self.showInstallError(_('Installation failed (exit: ') + d.exit_code + ')');
			}
		}).catch(function(e) {
			self.installPollTimer = setTimeout(function() { self.pollInstallLog(autoShowQRCode); }, 1500);
		});
	},

	showInstallSuccess: function(autoShowQRCode) {
		var self = this;
		var btn = oc.$('btn-install-plugin');

		oc.$('oc-install-progress').style.display = 'none';
		var resultEl = oc.$('oc-install-result');
		resultEl.style.display = 'block';
		resultEl.innerHTML = '<div class="oc-result-success">' + _('✅ WeChat plugin installed successfully!') + '</div>';

		btn.disabled = false;
		btn.textContent = _('📦 Reinstall Plugin');

		this.refreshWechatStatus();

		setTimeout(function() {
			self.closeInstallModal();
			self.showLoginQRCode();
		}, 1000);
	},

	showInstallError: function(message) {
		oc.$('oc-install-progress').style.display = 'none';
		var resultEl = oc.$('oc-install-result');
		resultEl.style.display = 'block';
		resultEl.innerHTML = '<div class="oc-result-error">❌ ' + oc.escapeHtml(message) + '</div>';

		var btn = oc.$('btn-install-plugin');
		btn.disabled = false;
		btn.textContent = _('📦 Install WeChat Plugin');
	},

	closeInstallModal: function() {
		oc.$('oc-install-modal').classList.remove('show');
		oc.$('oc-install-qrcode-link').style.display = 'none';
		if (this.installPollTimer) {
			clearTimeout(this.installPollTimer);
			this.installPollTimer = null;
		}
	},

	/* ── 登录 ── */
	showLoginQRCode: function() {
		var self = this;

		oc.$('oc-login-modal').classList.add('show');
		oc.$('oc-login-progress').style.display = 'block';
		oc.$('oc-login-qrcode').style.display = 'none';
		oc.$('oc-login-result').style.display = 'none';

		api.wechatLogin().then(function(d) {
			if (d.status === 'ok')
				setTimeout(function() { self.pollLoginStatus(); }, 2000);
			else
				self.showLoginError(d.message || _('Failed to start the login'));
		}).catch(function(e) {
			self.showLoginError(_('Failed to start the login: ') + e.message);
		});
	},

	logoutWechatAccount: function(accountId, btn) {
		var self = this;

		if (!confirm(_('Log out account ') + accountId + _('? After logging out you will need to scan the QR code again.')))
			return;

		var oldText = btn.textContent;
		btn.textContent = _('Logging out...');
		btn.disabled = true;

		api.wechatLogout(accountId).then(function(d) {
			btn.textContent = oldText;
			btn.disabled = false;
			self.refreshWechatStatus();
		}).catch(function(e) {
			btn.textContent = oldText;
			btn.disabled = false;
			alert(_('Failed to log out the account: ') + (e.message || e));
		});
	},

	pollLoginStatus: function() {
		var self = this;

		if (this.loginPollTimer)
			clearTimeout(this.loginPollTimer);

		api.wechatLoginStatus().then(function(d) {
			var qrcodeEl = oc.$('oc-login-qrcode');

			var isExpired = (d.qrcode && (d.qrcode.indexOf('已被扫描') > -1 || d.qrcode.indexOf('二维码已过期') > -1));
			var statusMessage = isExpired
				? '<p style="color:#cf222e;font-size:13px;margin:8px 0;text-align:center;">' + _('⌛ QR code refreshed — click the newest link to log in') + '</p>'
				: '<p style="font-size:14px;color:#333;margin-bottom:8px;text-align:center;">' + _('📱 Open the QR code from the link below and scan it with WeChat') + '</p>';

			if (d.state === 'success' || d.logged_in) {
				self.showLoginSuccess();
			}
			else if (d.state === 'failed') {
				self.showLoginError(d.message || _('Login failed'), d.error_detail || d.qrcode || '');
			}
			else if (d.state === 'qrcode' && d.qrcode_url) {
				oc.$('oc-login-progress').style.display = 'none';
				qrcodeEl.style.display = 'block';
				var safeUrl = oc.escapeHtml(d.qrcode_url);
				qrcodeEl.innerHTML = '<div class="oc-qrcode-box">' +
					statusMessage +
					'<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" class="oc-qrcode-link-btn" style="font-size:16px;">' + _('🔗 Open the link, then scan it with WeChat') + '</a>' +
					'<p class="oc-qrcode-copy-link">' + _('Or copy the link: ') + '<code>' + safeUrl + '</code>' +
					'<button class="oc-copy-btn" data-oc-copy="' + safeUrl.replace(/"/g, '&quot;') + '">' + _('Copy') + '</button>' + '</p>' +
					'</div>';
				self.wireCopyButtons(qrcodeEl);
				self.loginPollTimer = setTimeout(function() { self.pollLoginStatus(); }, 2000);
			}
			else if (d.running) {
				if (d.qrcode && d.qrcode.length > 50) {
					var extractedUrl = oc.extractWechatLoginUrl(d.qrcode);
					if (extractedUrl) {
						oc.$('oc-login-progress').style.display = 'none';
						qrcodeEl.style.display = 'block';
						var safeUrl2 = oc.escapeHtml(extractedUrl);
						qrcodeEl.innerHTML = '<div class="oc-qrcode-box">' +
							statusMessage +
							'<a href="' + safeUrl2 + '" target="_blank" rel="noopener noreferrer" class="oc-qrcode-link-btn" style="font-size:16px;">' + _('🔗 Open the link, then scan it with WeChat') + '</a>' +
							'<p class="oc-qrcode-copy-link">' + _('Or copy the link: ') + '<code>' + safeUrl2 + '</code>' +
							'<button class="oc-copy-btn" data-oc-copy="' + safeUrl2.replace(/"/g, '&quot;') + '">' + _('Copy') + '</button>' + '</p>' +
							'</div>';
						self.wireCopyButtons(qrcodeEl);
					}
					else {
						qrcodeEl.style.display = 'block';
						qrcodeEl.innerHTML = '<div class="oc-qrcode-box">' + '<p>' + _('Loading the login link...') + '</p>' + '</div>';
					}
				}
				self.loginPollTimer = setTimeout(function() { self.pollLoginStatus(); }, 2000);
			}
		}).catch(function(e) {
			self.loginPollTimer = setTimeout(function() { self.pollLoginStatus(); }, 2000);
		});
	},

	wireCopyButtons: function(scope) {
		var btns = scope.querySelectorAll('[data-oc-copy]');

		for (var i = 0; i < btns.length; i++) {
			btns[i].addEventListener('click', function() {
				oc.copyToClipboard(this.getAttribute('data-oc-copy'), this);
			});
		}
	},

	showLoginSuccess: function() {
		var self = this;

		oc.$('oc-login-progress').style.display = 'none';
		oc.$('oc-login-qrcode').style.display = 'none';
		var resultEl = oc.$('oc-login-result');
		resultEl.style.display = 'block';
		resultEl.innerHTML = _('✅ WeChat login successful!') + '<br>' + '<br>' + _('The gateway is reloading your WeChat account — wait 10-20 seconds, then send a test message from WeChat to verify.') + '</div>';

		this.refreshWechatStatus();
	},

	showLoginError: function(message, detail) {
		oc.$('oc-login-progress').style.display = 'none';
		var resultEl = oc.$('oc-login-result');
		resultEl.style.display = 'block';
		var html = '<div class="oc-result-error">❌ ' + oc.escapeHtml(message || _('Login failed'));
		if (detail)
			html += '<pre class="oc-error-detail">' + oc.escapeHtml(detail) + '</pre>';
		html += '</div>';
		resultEl.innerHTML = html;
	},

	closeLoginModal: function() {
		oc.$('oc-login-modal').classList.remove('show');
		if (this.loginPollTimer) {
			clearTimeout(this.loginPollTimer);
			this.loginPollTimer = null;
		}
	},

	/* ── 升级检测 / 升级 ── */
	checkUpgradeWechat: function() {
		var self = this;

		oc.$('oc-upgrade-modal').classList.add('show');
		oc.$('oc-upgrade-progress').style.display = 'block';
		oc.$('oc-upgrade-result').style.display = 'none';

		api.wechatCheckUpgrade().then(function(d) {
			oc.$('oc-upgrade-progress').style.display = 'none';
			var resultEl = oc.$('oc-upgrade-result');
			resultEl.style.display = 'block';

			if (d.has_upgrade) {
				resultEl.innerHTML = '<div class="oc-result-info">' +
					_('🔄 New version available: ') + d.latest_version + '<br>' +
					_('Current version: ') + d.current_version + '<br><br>' +
					'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-upgrade-now">' + _('Upgrade now') + '</button>' +
					'</div>';
				oc.$('btn-upgrade-now').addEventListener('click', function() {
					self.upgradeWechatPlugin();
				});
			}
			else if (!d.current_version) {
				resultEl.innerHTML = '<div class="oc-result-error">' + _('❌ Plugin not installed — install it first') + '</div>';
			}
			else if (d.status !== 'ok' || !d.latest_version) {
				resultEl.innerHTML = '<div class="oc-result-error">' + _('⚠️ Could not determine the latest version') +
					'<br>' + _('Currently installed: ') + d.current_version +
					(d.message ? '<br><span style="font-size:12px;">' + oc.escapeHtml(d.message) + '</span>' : '') +
					'</div>';
			}
			else {
				resultEl.innerHTML = '<div class="oc-result-success">' + _('✅ Already on the latest version: ') + d.current_version + '</div>';
			}
		}).catch(function(e) {
			oc.$('oc-upgrade-progress').style.display = 'none';
			var resultEl = oc.$('oc-upgrade-result');
			resultEl.style.display = 'block';
			resultEl.innerHTML = '<div class="oc-result-error">' + _('❌ Check failed: ') + e.message + '</div>';
		});
	},

	upgradeWechatPlugin: function() {
		var self = this;

		oc.$('oc-upgrade-result').innerHTML = '<div class="oc-progress-box">' + '<span class="oc-progress-spinner">' + '</span>' + '<span>' + _('Upgrading...') + '</span>' + '</div>';

		api.wechatUpgradePlugin().then(function(d) {
			if (d.status === 'ok') {
				oc.$('oc-upgrade-result').innerHTML = '<div class="oc-progress-box">' + '<pre id="oc-upgrade-log">' + 'Upgrading...' + '</pre>' + '<div id="oc-upgrade-qrcode-link" style="display:none;margin:10px 0;text-align:center;">' + '</div>' + '</div>';
				self.pollUpgradeLog();
			}
			else {
				oc.$('oc-upgrade-result').innerHTML = '<div class="oc-result-error">❌ ' + (d.message || _('Upgrade failed')) + '</div>';
			}
		}).catch(function(e) {
			oc.$('oc-upgrade-result').innerHTML = '<div class="oc-result-error">' + _('❌ Upgrade failed: ') + e.message + '</div>';
		});
	},

	pollUpgradeLog: function() {
		var self = this;

		api.wechatInstallLog().then(function(d) {
			var logEl = oc.$('oc-upgrade-log');

			if (logEl) {
				if (d.log) {
					var cleanLog = d.log.replace(/\x1b\[[0-9;]*m/g, '');
					cleanLog = cleanLog.replace(/\[openclaw-weixin\] /g, '');

					var linkMatch = cleanLog.match(/(https:\/\/liteapp\.weixin\.qq\.com\/q\/[^\s]+)/);
					if (linkMatch && linkMatch[1]) {
						var linkUrl = linkMatch[1];
						var linkContainer = oc.$('oc-upgrade-qrcode-link');
						if (linkContainer) {
							linkContainer.style.display = 'block';
							linkContainer.innerHTML = '<a href="' + oc.escapeHtml(linkUrl) + '" target="_blank" rel="noopener noreferrer" class="oc-qrcode-link-btn" style="padding:10px 20px;font-size:14px;margin:0;">' + _('🔗 Open the link, then scan it with WeChat') + '</a>';
						}
					}
					logEl.textContent = cleanLog;
				}
				else {
					logEl.textContent = _('Waiting for output...');
				}
				logEl.scrollTop = logEl.scrollHeight;
			}

			if (d.running) {
				self.upgradePollTimer = setTimeout(function() { self.pollUpgradeLog(); }, 1500);
			}
			else if (d.state === 'success') {
				oc.$('oc-upgrade-result').innerHTML = '<div class="oc-result-success">' + _('✅ Upgrade successful!') + '</div>';
				self.refreshWechatStatus();
			}
			else if (d.state === 'failed') {
				oc.$('oc-upgrade-result').innerHTML = '<div class="oc-result-error">' + _('❌ Upgrade failed') + '</div>';
			}
		}).catch(function(e) {
			self.upgradePollTimer = setTimeout(function() { self.pollUpgradeLog(); }, 1500);
		});
	},

	closeUpgradeModal: function() {
		oc.$('oc-upgrade-modal').classList.remove('show');
		if (this.upgradePollTimer) {
			clearTimeout(this.upgradePollTimer);
			this.upgradePollTimer = null;
		}
	},

	/* ── 卸载 ── */
	uninstallWechatPlugin: function() {
		var self = this;

		if (!confirm(_('Uninstall the WeChat plugin? This will delete all WeChat-related configuration.')))
			return;

		var btn = oc.$('btn-uninstall-plugin');
		btn.disabled = true;
		btn.textContent = _('⏳ Removing plugin...');

		api.wechatUninstall().then(function(d) {
			if (d.status === 'ok')
				alert('✅ ' + d.message);
			else
				alert('❌ ' + (d.message || _('Uninstall failed')));
		}).catch(function(e) {
			alert(_('Uninstall failed: ') + e.message);
		}).finally(function() {
			btn.disabled = false;
			btn.textContent = _('🗑️ Uninstall Plugin');
			self.refreshWechatStatus();
		});
	}
});
