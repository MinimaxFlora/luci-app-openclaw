'use strict';
'require view';
'require dom';

const api = require('openclaw.api');
const oc = require('openclaw.common');

/*
 * 终端配置 / 配置管理 (迁移自 luasrc/view/openclaw/advanced.htm)
 *
 * 内嵌 oc-config Web PTY 终端 (web-pty.js):
 *   状态/端口 → api.status();PTY 凭据 → api.getToken();设备配对 → api.devicesList/approve
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
			'.oc-console-info .btn-open{margin-left:auto;padding:5px 14px;background:#4a90d9;color:#fff;border:none;border-radius:4px;font-size:12px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:4px;font-weight:500;}',
			'.oc-console-info .btn-open:hover{background:#357abd;}',
			'.oc-terminal-wrap{border:2px solid #2d333b;border-radius:8px;overflow:hidden;background:#1a1b26;}',
			'#oc-terminal-iframe{width:100%;height:650px;border:none;display:block;}',
			'.oc-terminal-loading{display:flex;align-items:center;justify-content:center;min-height:250px;color:#7aa2f7;font-size:14px;background:#1a1b26;}'
		].join('\n');

		const html =
			'<style>' + style + '</style>' +
			'<div class="oc-page-header">' +
			'<h2>⚙️ 终端配置 (配置管理)</h2>' +
			'<p>通过交互式终端 (oc-config) 进行 OpenClaw 的完整配置管理。支持 AI 模型配置、消息渠道设置（QQ、Telegram、Discord 等）、健康检查等。</p>' +
			'</div>' +
			'<div class="oc-console-info">' +
			'<span class="label">终端服务：</span>' +
			'<span class="value" id="oc-term-addr">-</span>' +
			'<span class="sep">|</span>' +
			'<span class="label">状态：</span>' +
			'<span id="oc-term-status-text">检测中...</span>' +
			'<a id="oc-term-open-btn" class="btn-open" href="#" target="_blank" rel="noopener">↗ 新窗口打开终端</a>' +
			'</div>' +
			'<div id="oc-adv-pairing-banner" style="display:none;padding:12px 16px;margin-bottom:14px;background:#fffbe6;border:1px solid #ffe58f;border-left:4px solid #faad14;border-radius:6px;">' +
			'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
			'<div style="flex:1;min-width:280px;">' +
			'<div style="font-weight:600;color:#d48806;font-size:14px;margin-bottom:4px;display:flex;align-items:center;gap:8px;">' +
			'<span>🔔 检测到待配对设备请求</span>' +
			'<span id="oc-adv-pairing-badge" style="background:#faad14;color:#fff;padding:1px 7px;border-radius:10px;font-size:11px;">0</span>' +
			'</div>' +
			'<div style="font-size:13px;color:#555;line-height:1.5;margin-bottom:6px;">Control UI 浏览器连接时触发了安全配对策略，您可直接在此一键批准，无需在下方终端中手动查找与输入 Request ID。</div>' +
			'<div style="font-size:12px;color:#cf1322;background:#fff1f0;border:1px solid #ffa39e;padding:6px 10px;border-radius:4px;line-height:1.4;margin-bottom:6px;">⚠️ <strong>风险提示</strong>：批准设备配对后，该浏览器将获得 OpenClaw 网关的完全控制权限。请确保在受信任的局域网环境，并仅在您本人正在连接时批准。</div>' +
			'<div id="oc-adv-pairing-items" style="font-size:12px;font-family:monospace;color:#333;line-height:1.6;"></div>' +
			'</div>' +
			'<div style="display:flex;gap:8px;align-items:center;margin-top:4px;">' +
			'<button type="button" id="oc-adv-pairing-approve-all-btn" style="padding:6px 14px;background:#52c41a;color:#fff;border:none;border-radius:4px;font-weight:600;font-size:12px;cursor:pointer;">⚡ 一键批准配对</button>' +
			'<button type="button" id="oc-adv-pairing-refresh-btn" style="padding:6px 10px;background:#f0f2f5;color:#333;border:1px solid #d0d7de;border-radius:4px;font-size:12px;cursor:pointer;">🔄 刷新</button>' +
			'</div></div>' +
			'<div id="oc-adv-pairing-msg" style="display:none;margin-top:8px;font-size:13px;font-weight:500;"></div>' +
			'</div>' +
			'<div class="oc-terminal-wrap">' +
			'<div id="oc-terminal-container">' +
			'<div class="oc-terminal-loading" id="oc-terminal-loading">⏳ 正在连接配置终端...</div>' +
			'</div></div>';

		const root = E('div', { 'id': 'oc-adv-page' });

		root.innerHTML = html;

		this.initPage();

		return root;
	},

	/* state + DOM wiring; runs after render() so all nodes exist */
	initPage: function() {
		var self = this;

		this.ptyPort = '18793';
		this.ptyToken = '';
		this.targetUrl = '';
		this.iframeAdded = false;

		this.container = oc.$('oc-terminal-container');
		this.loading = oc.$('oc-terminal-loading');
		this.addrEl = oc.$('oc-term-addr');
		this.statusTextEl = oc.$('oc-term-status-text');
		this.openBtn = oc.$('oc-term-open-btn');

		this.advPairingBanner = oc.$('oc-adv-pairing-banner');
		this.advPairingBadge = oc.$('oc-adv-pairing-badge');
		this.advPairingItems = oc.$('oc-adv-pairing-items');
		this.advPairingMsg = oc.$('oc-adv-pairing-msg');

		oc.$('oc-adv-pairing-approve-all-btn').addEventListener('click', function() { self.approveAdvDevice(null); });
		oc.$('oc-adv-pairing-refresh-btn').addEventListener('click', function() { self.checkAdvDevices(); });

		this.bindMessageListener();
		this.checkAndLoadTerminal();
	},

	load: function() {
		return Promise.resolve();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	updateTargetUrl: function() {
		var host = window.location.hostname;
		var url = 'http://' + host + ':' + this.ptyPort + '/';

		if (this.ptyToken)
			url += '?pty_token=' + encodeURIComponent(this.ptyToken);

		this.targetUrl = url;
		if (this.openBtn)
			this.openBtn.href = url;
	},

	checkAdvDevices: function() {
		var self = this;

		api.devicesList().then(function(data) {
			var pending = (data && data.pending) || [];

			if (self.advPairingBadge)
				self.advPairingBadge.textContent = pending.length;

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
						'<button type="button" class="btn-adv-approve-single" data-rid="' + rid + '" style="font-size:12px;padding:3px 10px;background:#f6ffed;border:1px solid #b7eb8f;color:#389e0d;border-radius:4px;cursor:pointer;">批准配对</button>' +
						'</div>';
				}
				self.advPairingItems.innerHTML = html;
				self.advPairingBanner.style.display = 'block';

				var singleBtns = self.advPairingItems.querySelectorAll('.btn-adv-approve-single');
				for (var j = 0; j < singleBtns.length; j++) {
					singleBtns[j].addEventListener('click', function(ev) {
						var rid = this.getAttribute('data-rid');
						self.approveAdvDevice(rid);
					});
				}
			}
			else {
				self.advPairingBanner.style.display = 'none';
			}
		}).catch(function(e) {});
	},

	approveAdvDevice: function(rid) {
		var self = this;

		this.advPairingMsg.style.display = 'block';
		this.advPairingMsg.style.color = '#1890ff';
		this.advPairingMsg.textContent = '⏳ 正在批准设备配对...';

		api.devicesApprove(rid || '', rid ? false : true).then(function(res) {
			if (res.status === 'ok') {
				self.advPairingMsg.style.color = '#52c41a';
				self.advPairingMsg.innerHTML = '✅ ' + (res.message || '批准成功！');
				setTimeout(function() {
					self.checkAdvDevices();
				}, 1500);
			}
			else {
				self.advPairingMsg.style.color = '#cf222e';
				self.advPairingMsg.innerHTML = '❌ ' + (res.message || '批准失败');
			}
		}).catch(function(e) {
			self.advPairingMsg.style.color = '#cf222e';
			self.advPairingMsg.textContent = '❌ 批准失败：请求异常';
		});
	},

	checkAndLoadTerminal: function() {
		var self = this;

		this.checkAdvDevices();
		setTimeout(function() { self.checkAdvDevices(); }, 3000);

		Promise.all([api.getToken(), api.status()]).then(function(results) {
			var td = results[0];
			var d = results[1];

			self.ptyToken = td.pty_token || '';
			if (d.pty_port)
				self.ptyPort = d.pty_port;
			if (self.addrEl)
				self.addrEl.textContent = window.location.hostname + ':' + self.ptyPort;
			self.updateTargetUrl();

			if (d.pty_running) {
				if (self.statusTextEl)
					self.statusTextEl.innerHTML = '<span style="color:#1a7f37;">● 运行中</span>';
				self.showIframe();
			}
			else {
				if (self.statusTextEl)
					self.statusTextEl.innerHTML = '<span style="color:#cf222e;">● 未运行</span>';
				self.loading.innerHTML = '<div style="text-align:center;padding:24px;color:#cf222e;">❌ 配置终端未运行<br/>' +
					'<span style="font-size:12px;color:#999;">请先在「基本设置」中启用并启动服务。</span></div>';
			}
		}).catch(function(e) {
			if (self.statusTextEl)
				self.statusTextEl.textContent = '检测完成';
			self.showIframe();
		});
	},

	showIframe: function() {
		var self = this;
		var isHttps = (window.location.protocol === 'https:');

		if (isHttps) {
			this.loading.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#abb2bf;">' +
				'<div style="font-size:36px;margin-bottom:12px;">↗</div>' +
				'<div style="font-size:15px;margin-bottom:8px;color:#e5c07b;font-weight:600;">由于浏览器安全策略限制，无法在 HTTPS 页面中直接内嵌 HTTP 终端</div>' +
				'<div style="font-size:13px;color:#828997;max-width:560px;margin:0 auto 20px;line-height:1.6;">' +
				'终端服务已在端口 ' + this.ptyPort + ' 正常就绪。请点击下方按钮直接在新窗口打开交互式终端，已自动绑定认证 Token。' +
				'</div>' +
				'<a href="' + this.targetUrl + '" target="_blank" rel="noopener" style="display:inline-block;padding:9px 24px;background:#4a90d9;color:#fff;border-radius:6px;text-decoration:none;font-weight:500;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.3);">立即在新窗口打开终端</a>' +
				'<div style="margin-top:16px;font-size:12px;color:#5c6370;">小贴士：您也可以通过 HTTP (http://' + window.location.hostname + ') 登录路由器后台直接在此内嵌操作。</div>' +
				'</div>';
			return;
		}

		this.loading.style.display = 'none';

		var iframe = document.createElement('iframe');
		iframe.id = 'oc-terminal-iframe';
		iframe.src = this.targetUrl;
		iframe.setAttribute('allowfullscreen', 'true');
		iframe.setAttribute('allow', 'clipboard-read; clipboard-write');
		iframe.addEventListener('load', function() {
			try { iframe.contentWindow.focus(); } catch (e) {}
		});
		this.container.appendChild(iframe);
		this.iframeAdded = true;

		this.container.addEventListener('click', function() {
			try { iframe.contentWindow.focus(); } catch (e) {}
		});

		/* 防止 LuCI 父页面键盘事件干扰 iframe 内的终端输入 */
		var termWrap = document.querySelector('.oc-terminal-wrap');
		if (termWrap) {
			termWrap.addEventListener('keydown', function(e) { e.stopPropagation(); }, true);
			termWrap.addEventListener('keypress', function(e) { e.stopPropagation(); }, true);
			termWrap.addEventListener('keyup', function(e) { e.stopPropagation(); }, true);
		}
	},

	/* 监听 iframe 终端的 token 请求, 支持重载后自动补充认证凭据 */
	bindMessageListener: function() {
		var self = this;

		window.addEventListener('message', function(ev) {
			if (ev.data && ev.data.type === 'openclaw_request_token') {
				var srcWin = ev.source;

				if (self.ptyToken) {
					if (srcWin) {
						try { srcWin.postMessage({ type: 'openclaw_token', pty_token: self.ptyToken }, '*'); } catch (e) {}
					}
				}
				else {
					api.getToken().then(function(td) {
						self.ptyToken = td.pty_token || '';
						self.updateTargetUrl();
						if (self.ptyToken && srcWin) {
							try { srcWin.postMessage({ type: 'openclaw_token', pty_token: self.ptyToken }, '*'); } catch (e) {}
						}
					}).catch(function() {});
				}
			}
		});
	}
});
