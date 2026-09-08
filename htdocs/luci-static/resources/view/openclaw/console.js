'use strict';
'require view';
'require dom';

const api = require('openclaw.api');
const oc = require('openclaw.common');

/*
 * Web 控制台 (迁移自 luasrc/view/openclaw/console.htm)
 *
 * 内嵌 OpenClaw 官方 Control UI / WebChat:
 *   状态查询 → api.status();网关/PTY 凭据 → api.getToken();设备配对 → api.devicesList/approve
 */
return view.extend({
	render: function() {
		const style = [
			'.oc-page-header{margin:0 0 16px 0;}',
			'.oc-page-header h2{font-size:18px;font-weight:600;color:#333;margin:0 0 6px 0;}',
			'.oc-page-header p{font-size:13px;color:#666;margin:0;line-height:1.6;}',
			'.oc-console-info{display:flex;align-items:center;gap:12px;padding:10px 16px;margin-bottom:16px;background:#f6f8fa;border:1px solid #e1e4e8;border-radius:6px;font-size:13px;color:#555;flex-wrap:wrap;}',
			'.oc-console-info .label{color:#888;}',
			'.oc-console-info .value{font-family:monospace;color:#333;font-weight:500;}',
			'.oc-console-info .sep{color:#ddd;}',
			'.oc-console-actions{margin-left:auto;display:flex;gap:8px;align-items:center;}',
			'.oc-console-actions .btn-action{padding:4px 12px;background:#f0f2f5;color:#333;border:1px solid #d0d7de;border-radius:4px;font-size:12px;cursor:pointer;text-decoration:none;transition:background 0.2s;}',
			'.oc-console-actions .btn-action:hover{background:#e1e4e8;text-decoration:none;}',
			'.oc-console-actions .btn-open{padding:4px 14px;background:#4a90d9;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;text-decoration:none;}',
			'.oc-console-actions .btn-open:hover{background:#357abd;text-decoration:none;}',
			'.oc-console-wrap{border:2px solid #e0e0e0;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.06);position:relative;min-height:720px;}',
			'.oc-console-wrap:fullscreen{border:none;border-radius:0;height:100vh;width:100vw;}',
			'.oc-console-wrap:-webkit-full-screen{border:none;border-radius:0;height:100vh;width:100vw;}',
			'#oc-console-iframe{width:100%;height:760px;border:none;display:block;}',
			'.oc-console-wrap:fullscreen #oc-console-iframe,.oc-console-wrap:-webkit-full-screen #oc-console-iframe{height:100vh;}',
			'.oc-console-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;height:360px;color:#666;font-size:14px;background:#fafafa;}',
			'.oc-console-loading .spinner{width:32px;height:32px;border:3px solid #e0e0e0;border-top:3px solid #4a90d9;border-radius:50%;animation:oc-spin .8s linear infinite;margin-bottom:12px;}',
			'@keyframes oc-spin{to{transform:rotate(360deg);}}'
		].join('\n');

		const html =
			'<style>' + style + '</style>' +
			'<div class="oc-page-header">' +
			'<h2>🖥️ Web 控制台</h2>' +
			'<p>OpenClaw 官方 Web 管理界面 — 在这里可以配置 AI 模型、消息渠道（QQ、Telegram、Discord 等），直接与 AI 进行对话，以及管理所有功能。</p>' +
			'</div>' +
			'<div class="oc-console-info">' +
			'<span class="label">网关地址：</span>' +
			'<span class="value" id="oc-console-addr">-</span>' +
			'<span class="sep">|</span>' +
			'<span class="label">活跃模型：</span>' +
			'<span class="value" id="oc-console-model" style="color:#555;">-</span>' +
			'<span class="sep">|</span>' +
			'<span class="label">状态：</span>' +
			'<span id="oc-console-status-text">检查中...</span>' +
			'<div class="oc-console-actions" id="oc-console-actions" style="display:none;">' +
			'<button type="button" id="oc-console-pairing-toggle-btn" class="btn-action" title="管理/批准设备配对请求">📱 设备配对 <span id="oc-console-pairing-nav-badge" style="display:none;background:#ff4d4f;color:#fff;padding:0 6px;border-radius:10px;font-size:11px;font-weight:600;margin-left:2px;">0</span></button>' +
			'<button type="button" id="oc-console-refresh-btn" class="btn-action" title="重新载入当前会话">🔄 刷新</button>' +
			'<button type="button" id="oc-console-fullscreen-btn" class="btn-action" title="全屏查看">⛶ 全屏</button>' +
			'<a id="oc-console-open-btn" class="btn-open" href="#" target="_blank" rel="noopener">↗ 新窗口打开</a>' +
			'</div>' +
			'</div>' +
			'<div id="oc-pairing-banner" style="display:none;padding:12px 16px;margin-bottom:14px;background:#fffbe6;border:1px solid #ffe58f;border-left:4px solid #faad14;border-radius:6px;">' +
			'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
			'<div style="flex:1;min-width:280px;">' +
			'<div style="font-weight:600;color:#d48806;font-size:14px;margin-bottom:4px;display:flex;align-items:center;gap:8px;">' +
			'<span>🔔 检测到待配对设备请求</span>' +
			'<span id="oc-pairing-badge" style="background:#faad14;color:#fff;padding:1px 7px;border-radius:10px;font-size:11px;">0</span>' +
			'</div>' +
			'<div style="font-size:13px;color:#555;line-height:1.5;margin-bottom:6px;">首次访问 Control UI 时网关需要主机批准该浏览器。点击「一键批准配对」即可完成授权并进入控制台。</div>' +
			'<div style="font-size:12px;color:#cf1322;background:#fff1f0;border:1px solid #ffa39e;padding:6px 10px;border-radius:4px;line-height:1.4;margin-bottom:6px;">⚠️ <strong>风险提示</strong>：批准设备配对后，该浏览器将获得 OpenClaw 网关的完全控制权限。请确保在受信任的局域网环境，并仅在您本人正在连接时批准。</div>' +
			'<div id="oc-pairing-items" style="font-size:12px;font-family:monospace;color:#333;line-height:1.6;"></div>' +
			'</div>' +
			'<div style="display:flex;gap:8px;align-items:center;margin-top:4px;">' +
			'<button type="button" id="oc-pairing-approve-all-btn" class="btn-open" style="background:#52c41a;font-weight:600;padding:6px 14px;">⚡ 一键批准配对</button>' +
			'<button type="button" id="oc-pairing-refresh-btn" class="btn-action" style="padding:6px 10px;">🔄 刷新</button>' +
			'</div></div>' +
			'<div id="oc-pairing-msg" style="display:none;margin-top:8px;font-size:13px;font-weight:500;"></div>' +
			'</div>' +
			'<div id="oc-console-https-hint" style="display:none;padding:10px 14px;margin-bottom:14px;background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;font-size:13px;color:#d48806;line-height:1.6;">' +
			'⚠️ <strong>浏览器安全提示</strong>：当前正在通过 HTTPS 访问 LuCI。由于 OpenClaw 网关为 HTTP 服务，浏览器可能会拦截跨协议内嵌页面（Mixed Content）。若下方界面显示空白，请点击右上角「<strong>↗ 新窗口打开</strong>」直接访问会话，或改用 HTTP 协议访问 LuCI。' +
			'</div>' +
			'<div class="oc-console-wrap" id="oc-console-wrap">' +
			'<div id="oc-console-container">' +
			'<div class="oc-console-loading" id="oc-console-loading">' +
			'<div class="spinner"></div>' +
			'<span>正在连接 OpenClaw 控制台...</span>' +
			'</div></div></div>';

		const root = E('div', { 'id': 'oc-console-page' });

		root.innerHTML = html;

		this.initPage();

		return root;
	},

	/* state + DOM wiring; runs after render() so all nodes exist */
	initPage: function() {
		var self = this;

		this.gwPort = '';
		this.gwToken = '';
		this.retryTimer = null;
		this.iframeEl = null;
		this.container = oc.$('oc-console-container');
		this.loading = oc.$('oc-console-loading');
		this.addrEl = oc.$('oc-console-addr');
		this.modelEl = oc.$('oc-console-model');
		this.statusTextEl = oc.$('oc-console-status-text');
		this.actionsEl = oc.$('oc-console-actions');
		this.openBtn = oc.$('oc-console-open-btn');
		this.wrapEl = oc.$('oc-console-wrap');

		this.pairingBanner = oc.$('oc-pairing-banner');
		this.pairingBadge = oc.$('oc-pairing-badge');
		this.pairingItems = oc.$('oc-pairing-items');
		this.pairingMsg = oc.$('oc-pairing-msg');

		oc.$('oc-console-refresh-btn').addEventListener('click', function() { self.refreshConsole(); });
		oc.$('oc-console-fullscreen-btn').addEventListener('click', function() { self.toggleFullScreen(); });
		oc.$('oc-pairing-approve-all-btn').addEventListener('click', function() { self.approveDevice(null); });
		oc.$('oc-pairing-refresh-btn').addEventListener('click', function() { self.checkDevices(true); });
		oc.$('oc-console-pairing-toggle-btn').addEventListener('click', function() {
			if (self.pairingBanner.style.display === 'none')
				self.checkDevices(true);
			else
				self.pairingBanner.style.display = 'none';
		});

		this.checkAndLoad();
	},

	load: function() {
		return Promise.resolve();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	getConsoleUrl: function() {
		var host = window.location.hostname;
		var url = 'http://' + host + ':' + this.gwPort + '/';

		if (this.gwToken)
			url += '#token=' + encodeURIComponent(this.gwToken);

		return url;
	},

	toggleFullScreen: function() {
		if (!document.fullscreenElement && !document.webkitFullscreenElement) {
			if (this.wrapEl.requestFullscreen)
				this.wrapEl.requestFullscreen();
			else if (this.wrapEl.webkitRequestFullscreen)
				this.wrapEl.webkitRequestFullscreen();
		}
		else {
			if (document.exitFullscreen)
				document.exitFullscreen();
			else if (document.webkitExitFullscreen)
				document.webkitExitFullscreen();
		}
	},

	scheduleCheck: function(ms) {
		var self = this;

		if (this.retryTimer)
			clearTimeout(this.retryTimer);
		this.retryTimer = setTimeout(function() {
			self.retryTimer = null;
			self.checkAndLoad();
		}, ms || 3000);
	},

	checkAndLoad: function() {
		var self = this;

		this.addrEl.textContent = window.location.hostname + ':' + this.gwPort;

		api.getToken().then(function(td) {
			self.gwToken = td.token || '';
			return api.status();
		}).then(function(d) {
			if (d.gateway_running) {
				if (self.retryTimer) {
					clearTimeout(self.retryTimer);
					self.retryTimer = null;
				}
				if (d.active_model)
					self.modelEl.textContent = d.active_model;
				self.gwPort = d.port || self.gwPort;
				self.statusTextEl.innerHTML = '<span style="color:#1a7f37;">● 网关运行中</span>';
				self.openBtn.href = self.getConsoleUrl();
				self.actionsEl.style.display = 'flex';
				if (location.protocol === 'https:') {
					var hintEl = oc.$('oc-console-https-hint');
					if (hintEl)
						hintEl.style.display = 'block';
				}
				self.showIframe(self.getConsoleUrl());
				self.checkDevices(false);
				setTimeout(function() { self.checkDevices(false); }, 2500);
				setTimeout(function() { self.checkDevices(false); }, 6000);
			}
			else if (d.gateway_failed) {
				if (self.retryTimer) {
					clearTimeout(self.retryTimer);
					self.retryTimer = null;
				}
				self.statusTextEl.innerHTML = '<span style="color:#cf222e;">● 网关启动失败</span>';
				self.actionsEl.style.display = 'none';
				self.loading.style.display = '';
				self.loading.innerHTML = '<div style="text-align:center;color:#666;">' +
					'<div style="font-size:40px;margin-bottom:12px;">×</div>' +
					'<div style="font-size:15px;margin-bottom:6px;">OpenClaw 网关启动失败</div>' +
					'<div style="font-size:12px;color:#999;">退出码：' + (d.gateway_exit_code || '-') + '。请查看系统日志或安装日志。</div>' +
					'</div>';
			}
			else if (d.gateway_starting) {
				self.gwPort = d.port || self.gwPort;
				self.statusTextEl.innerHTML = '<span style="color:#9a6700;">⏳ 网关正在启动</span>';
				self.actionsEl.style.display = 'none';
				self.loading.style.display = '';
				self.loading.innerHTML = '<div style="text-align:center;color:#666;">' +
					'<div style="font-size:40px;margin-bottom:12px;">⏳</div>' +
					'<div style="font-size:15px;margin-bottom:6px;">OpenClaw 网关正在启动中...</div>' +
					'<div style="font-size:12px;color:#999;">通常 20~40 秒；首次安装或路由器负载较高时会更久，页面会自动刷新。</div>' +
					'</div>';
				self.scheduleCheck(3000);
			}
			else {
				self.gwPort = d.port || self.gwPort;
				self.statusTextEl.innerHTML = '<span style="color:#cf222e;">● 网关未运行</span>';
				self.actionsEl.style.display = 'none';
				self.loading.style.display = '';
				self.loading.innerHTML = '<div style="text-align:center;color:#666;">' +
					'<div style="font-size:40px;margin-bottom:12px;">🧠</div>' +
					'<div style="font-size:15px;margin-bottom:6px;">OpenClaw 网关未运行</div>' +
					'<div style="font-size:12px;color:#999;">请先在「基本设置」页面启用服务并启动。</div>' +
					'</div>';
				self.scheduleCheck(5000);
			}
		}).catch(function(e) {
			self.statusTextEl.textContent = '查询失败';
			self.scheduleCheck(5000);
		});
	},

	showIframe: function(url) {
		this.loading.style.display = 'none';

		if (!this.iframeEl) {
			this.iframeEl = document.createElement('iframe');
			this.iframeEl.id = 'oc-console-iframe';
			this.iframeEl.setAttribute('allowfullscreen', 'true');
			this.iframeEl.setAttribute('allow', 'clipboard-read; clipboard-write; microphone; camera; display-capture');
			this.container.appendChild(this.iframeEl);
		}

		if (this.iframeEl.src !== url)
			this.iframeEl.src = url;
	},

	refreshConsole: function() {
		if (this.iframeEl)
			this.iframeEl.src = this.getConsoleUrl();
	},

	checkDevices: function(manualOpen) {
		var self = this;

		api.devicesList().then(function(data) {
			var pending = (data && data.pending) || [];

			if (self.pairingBadge)
				self.pairingBadge.textContent = pending.length;
			var navBadge = oc.$('oc-console-pairing-nav-badge');
			if (navBadge) {
				if (pending.length > 0) {
					navBadge.textContent = pending.length;
					navBadge.style.display = 'inline';
				}
				else {
					navBadge.style.display = 'none';
				}
			}

			if (pending.length > 0) {
				var html = '';
				for (var i = 0; i < pending.length; i++) {
					var item = pending[i];
					var ip = oc.escapeHtml(item.remoteIp || item.ip || '未知IP');
					var client = oc.escapeHtml(item.clientId || item.clientMode || 'webchat');
					var plat = oc.escapeHtml(item.platform || '');
					var rid = oc.escapeHtml(item.requestId || '');
					html += '<div style="background:#fff;border:1px solid #e1e4e8;border-radius:4px;padding:6px 10px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
						'<div><strong>IP:</strong> ' + ip + ' | <strong>客户端:</strong> ' + client + (plat ? ' (' + plat + ')' : '') + ' <br/><span style="color:#888;font-size:11px;">ID: ' + rid + '</span></div>' +
						'<button type="button" class="btn-action btn-approve-single" data-rid="' + rid + '" style="font-size:12px;padding:3px 10px;background:#f6ffed;border-color:#b7eb8f;color:#389e0d;cursor:pointer;">批准配对</button>' +
						'</div>';
				}
				self.pairingItems.innerHTML = html;
				self.pairingBanner.style.display = 'block';

				var singleBtns = self.pairingItems.querySelectorAll('.btn-approve-single');
				for (var j = 0; j < singleBtns.length; j++) {
					singleBtns[j].addEventListener('click', function(ev) {
						var rid = this.getAttribute('data-rid');
						self.approveDevice(rid);
					});
				}
			}
			else {
				self.pairingItems.innerHTML = '<div style="color:#666;font-size:12px;padding:4px 0;">当前无待配对设备请求。当浏览器连接控制台提示「需要设备配对」时，在此刷新即可显示并批准。</div>';
				if (manualOpen)
					self.pairingBanner.style.display = 'block';
				else
					self.pairingBanner.style.display = 'none';
			}
		}).catch(function(e) {
			if (manualOpen) {
				self.pairingItems.innerHTML = '<div style="color:#cf222e;font-size:12px;">查询设备列表失败</div>';
				self.pairingBanner.style.display = 'block';
			}
		});
	},

	approveDevice: function(rid) {
		var self = this;

		this.pairingMsg.style.display = 'block';
		this.pairingMsg.style.color = '#1890ff';
		this.pairingMsg.textContent = '⏳ 正在批准设备配对...';

		var args = {};

		if (rid)
			args.request_id = rid;
		else
			args.all = true;

		api.devicesApprove(args.request_id || '', args.all || false).then(function(res) {
			if (res.status === 'ok') {
				self.pairingMsg.style.color = '#52c41a';
				self.pairingMsg.innerHTML = '✅ ' + (res.message || '批准成功！') + ' 正在重新载入控制台...';
				setTimeout(function() {
					self.checkDevices(false);
					if (self.iframeEl)
						self.iframeEl.src = self.getConsoleUrl();
				}, 1500);
			}
			else {
				self.pairingMsg.style.color = '#cf222e';
				self.pairingMsg.innerHTML = '❌ ' + (res.message || '批准失败');
			}
		}).catch(function(e) {
			self.pairingMsg.style.color = '#cf222e';
			self.pairingMsg.textContent = '❌ 批准失败：请求异常';
		});
	}
});
