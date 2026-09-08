'use strict';
'require view';
'require ui';
'require dom';

const api = require('openclaw.api');
const oc = require('openclaw.common');

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
			'<h2>OpenClaw AI 网关</h2>' +
			'<div class="cbi-map-descr">OpenClaw 是一个 AI 编程代理网关，支持 GitHub Copilot、Claude、GPT、Gemini 等大模型以及 QQ、Telegram、Discord 等多种消息渠道。</div>' +
			'<div id="oc-status-panel">' +
			'<div class="panel-title" id="oc-panel-title">🦞 OpenClaw 服务状态</div>' +
			'<div class="panel-body"><table>' +
			'<tr><td>运行状态</td><td id="oc-st-status"><span class="oc-badge oc-badge-unknown">加载中...</span></td></tr>' +
			'<tr><td>网关服务</td><td id="oc-st-gateway">-</td></tr>' +
			'<tr><td>配置终端</td><td id="oc-st-pty">-</td></tr>' +
			'<tr><td>活跃模型</td><td id="oc-st-model">-</td></tr>' +
			'<tr><td>消息渠道</td><td id="oc-st-channels">-</td></tr>' +
			'<tr><td>进程 PID</td><td id="oc-st-pid">-</td></tr>' +
			'<tr><td>内存占用</td><td id="oc-st-mem">-</td></tr>' +
			'<tr><td>运行时间</td><td id="oc-st-uptime">-</td></tr>' +
			'<tr><td>Node.js</td><td id="oc-st-node">-</td></tr>' +
			'<tr><td>OpenClaw</td><td id="oc-st-oc-ver">-</td></tr>' +
			'<tr><td>插件版本</td><td id="oc-st-plugin">-</td></tr>' +
			'<tr><td>安装路径</td><td id="oc-st-path">-</td></tr>' +
			'<tr><td>剩余空间</td><td id="oc-st-disk">-</td></tr>' +
			'</table></div></div>' +

			'<fieldset class="cbi-section" id="oc-quick-section"><legend>快捷操作</legend><div class="cbi-section-node">' +
			'<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0;">' +
			'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-setup" title="下载 Node.js 并安装 OpenClaw">📦 安装运行环境</button>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-restart">🔄 重启服务</button>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-stop">⏹️ 停止服务</button>' +
			'<span style="position:relative;display:inline-block;" id="btn-check-update-wrap"><button class="btn cbi-button cbi-button-action" type="button" id="btn-check-update">🔍 检测升级</button><span id="update-dot" style="display:none;position:absolute;top:-2px;right:-2px;width:10px;height:10px;background:#e36209;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #e36209;"></span></span>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-backup" title="备份或恢复 OpenClaw 配置">💾 备份/恢复</button>' +
			'<button class="btn cbi-button cbi-button-remove" type="button" id="btn-uninstall" title="删除 Node.js、OpenClaw 运行环境及相关数据">🗑️ 卸载环境</button>' +
			'</div>' +
			'<div id="action-result" style="margin-top:8px;"></div>' +
			'<div id="oc-update-action" style="margin-top:8px;display:none;"></div>' +
			'</div></fieldset>' +

			/* 安装日志面板 (默认隐藏) */
			'<div id="setup-log-panel" style="display:none;margin-top:12px;">' +
			'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
			'<span id="setup-log-title" style="font-weight:600;font-size:14px;">📋 安装日志</span>' +
			'<span id="setup-log-status" style="font-size:12px;color:#999;"></span></div>' +
			'<pre id="setup-log-content" style="background:#1a1b26;color:#a9b1d6;padding:14px 16px;border-radius:6px;font-size:12px;line-height:1.6;max-height:400px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;border:1px solid #2d333b;margin:0;"></pre>' +
			'<div id="setup-log-result" style="margin-top:10px;display:none;"></div></div>' +

			/* 使用指南 (原 basic.lua 尾部) */
			'<div style="border:1px solid #d0e8ff;background:#f0f7ff;padding:14px 18px;border-radius:6px;margin-top:12px;line-height:1.8;font-size:13px;">' +
			'<strong style="font-size:14px;">📖 使用指南</strong><br/>' +
			'<span style="color:#555;">' +
			'① 首次使用请点击 <b>「安装运行环境」</b>，安装完成后服务会自动启动<br/>' +
			'② 进入 <b>「配置管理」</b> 使用交互式向导快速配置 AI 模型和 API Key<br/>' +
			'③ 进入 <b>「Web 控制台」</b> 配置消息渠道，直接开始对话</span>' +
			'<div style="margin-top:10px;padding-top:10px;border-top:1px solid #d0e8ff;">' +
			'<span style="color:#888;">有疑问？请关注B站并留言：</span>' +
			'<a href="https://space.bilibili.com/59438380" target="_blank" rel="noopener" style="color:#00a1d6;font-weight:bold;text-decoration:none;">🔗 space.bilibili.com/59438380</a>' +
			'<span style="margin-left:16px;color:#888;">GitHub 项目：</span>' +
			'<a href="https://github.com/10000ge10000/luci-app-openclaw" target="_blank" rel="noopener" style="color:#24292f;font-weight:bold;text-decoration:none;">🐙 10000ge10000/luci-app-openclaw</a>' +
			'</div></div>' +

			/* 版本选择对话框 (原 CBI 内联样式) */
			'<div id="oc-setup-dialog" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;">' +
			'<div style="background:#fff;border-radius:12px;padding:24px 28px;max-width:520px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">' +
			'<h3 style="margin:0 0 16px 0;font-size:16px;color:#333;">📦 选择安装版本</h3>' +
			'<div style="display:flex;flex-direction:column;gap:12px;">' +
			'<label style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border:2px solid #4a90d9;border-radius:8px;cursor:pointer;background:#f0f7ff;" id="oc-opt-stable">' +
			'<input type="radio" name="oc-ver-choice" value="stable" checked style="margin-top:2px;">' +
			'<div><strong style="color:#333;">✅ 稳定版 (推荐)</strong>' +
			'<div style="font-size:12px;color:#666;margin-top:4px;" id="oc-stable-desc">版本 v2026.9.1 (已验证版)，已经过完整测试，兼容性良好。</div>' +
			'</div></label>' +
			'<label style="display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;background:#fff;" id="oc-opt-latest">' +
			'<input type="radio" name="oc-ver-choice" value="latest" style="margin-top:2px;">' +
			'<div><strong style="color:#333;">🆕 最新版 (未经验证)</strong>' +
			'<div style="font-size:12px;color:#e36209;margin-top:4px;">⚠️ 安装 npm 上的最新发布版本 (未经验证)，可能存在未经验证的兼容性问题。</div>' +
			'</div></label>' +
			'</div>' +
			'<div style="margin-top:16px;padding-top:14px;border-top:1px solid #eee;">' +
			'<div style="font-weight:600;font-size:13px;color:#333;margin-bottom:8px;">📂 安装路径</div>' +
			'<div style="display:flex;gap:8px;align-items:center;">' +
			'<input type="text" id="oc-install-path" value="/opt" style="flex:1;padding:8px 12px;border:1px solid #d0d7de;border-radius:6px;font-size:13px;" placeholder="/opt">' +
			'<button class="btn cbi-button" type="button" id="btn-check-path" style="font-size:12px;padding:4px 10px;">检测空间</button>' +
			'</div>' +
			'<div id="oc-path-info" style="font-size:11px;color:#666;margin-top:6px;">💡 程序将在此路径下创建 openclaw 目录进行安装。最小需要 2GB 可用空间。如安装在第二块硬盘，请确保硬盘已挂载。</div>' +
			'</div>' +
			'<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">' +
			'<button class="btn cbi-button" type="button" id="btn-setup-cancel" style="min-width:80px;">取消</button>' +
			'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-setup-confirm" style="min-width:80px;">开始安装</button>' +
			'</div></div></div>' +

			/* 备份/恢复对话框 */
			'<div id="oc-backup-dialog" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;align-items:center;justify-content:center;">' +
			'<div style="background:#fff;border-radius:12px;padding:24px 28px;max-width:520px;width:92%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">' +
			'<h3 style="margin:0 0 16px 0;font-size:16px;color:#333;">💾 备份 / 恢复配置</h3>' +
			'<div style="margin-bottom:16px;">' +
			'<div style="font-weight:600;font-size:13px;color:#555;margin-bottom:8px;">📤 创建备份</div>' +
			'<div style="display:flex;gap:10px;">' +
			'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-bk-config" style="font-size:12px;">📄 仅配置文件</button>' +
			'<button class="btn cbi-button cbi-button-action" type="button" id="btn-bk-full" style="font-size:12px;">📦 配置 + 状态数据</button>' +
			'</div>' +
			'<div style="font-size:11px;color:#888;margin-top:6px;">仅配置文件 (~2KB) 包含模型、渠道、插件设置；完整备份含会话历史等状态数据（可能较大）</div>' +
			'</div>' +
			'<div style="border-top:1px solid #eee;padding-top:14px;margin-bottom:16px;">' +
			'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
			'<div style="font-weight:600;font-size:13px;color:#555;">📥 现有备份</div>' +
			'<button class="btn cbi-button" type="button" id="btn-bk-refresh" style="font-size:11px;padding:2px 10px;">🔄 刷新</button>' +
			'</div>' +
			'<div id="oc-backup-list" style="max-height:260px;overflow-y:auto;"></div>' +
			'</div>' +
			'<div id="oc-backup-result" style="margin-bottom:14px;display:none;"></div>' +
			'<div style="display:flex;justify-content:flex-end;">' +
			'<button class="btn cbi-button" type="button" id="btn-bk-close" style="min-width:80px;">关闭</button>' +
			'</div></div></div>';

		const root = E('div', { 'class': 'cbi-map', 'id': 'content' });

		root.innerHTML = html;

		this.bindEvents();
		this.bindStatusPoll();
		this.startUpdateDotCheck();

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
					stEl.innerHTML = '<span class="oc-badge oc-badge-unknown">查询失败</span>';
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
			stEl.innerHTML = '<span class="oc-badge oc-badge-disabled">已禁用</span>';
		else if (d.gateway_running)
			stEl.innerHTML = '<span class="oc-badge oc-badge-running">运行中</span>';
		else if (d.gateway_starting)
			stEl.innerHTML = '<span class="oc-badge oc-badge-starting">⏳ 正在启动...</span>';
		else if (d.gateway_failed)
			stEl.innerHTML = '<span class="oc-badge oc-badge-failed">启动失败</span>';
		else
			stEl.innerHTML = '<span class="oc-badge oc-badge-stopped">已停止</span>';

		var gwEl = oc.$('oc-st-gateway');
		if (d.gateway_running)
			gwEl.innerHTML = '<span class="oc-dot oc-dot-green"></span>监听中 :' + d.port;
		else if (d.gateway_starting)
			gwEl.innerHTML = '<span class="oc-dot oc-dot-gray"></span>初始化中，通常 20~40 秒；首次安装或负载较高时会更久...';
		else if (d.gateway_failed)
			gwEl.innerHTML = '<span class="oc-dot oc-dot-red"></span>启动失败，退出码 ' + (d.gateway_exit_code || '-');
		else
			gwEl.innerHTML = '<span class="oc-dot oc-dot-red"></span>未监听';

		var ptyEl = oc.$('oc-st-pty');
		if (d.pty_running)
			ptyEl.innerHTML = '<span class="oc-dot oc-dot-green"></span>监听中 :' + d.pty_port;
		else
			ptyEl.innerHTML = '<span class="oc-dot oc-dot-gray"></span>未监听';

		oc.$('oc-st-pid').textContent = d.pid || '-';

		var channelsEl = oc.$('oc-st-channels');
		if (d.channels)
			channelsEl.innerHTML = '<span style="color:#1a7f37;font-weight:500;">' + d.channels + '</span>';
		else
			channelsEl.textContent = '未配置';

		var modelEl = oc.$('oc-st-model');
		if (d.active_model)
			modelEl.innerHTML = '<code style="padding:2px 8px;background:#f0f3f6;border-radius:4px;font-size:12px;">' + d.active_model + '</code>';
		else
			modelEl.textContent = '未配置';

		var memEl = oc.$('oc-st-mem');
		if (d.memory_kb > 0)
			memEl.textContent = (d.memory_kb / 1024).toFixed(1) + ' MB';
		else
			memEl.textContent = '-';

		oc.$('oc-st-uptime').textContent = d.uptime || '-';
		oc.$('oc-st-node').textContent = d.node_version || '未安装';
		oc.$('oc-st-oc-ver').textContent = d.oc_version ? ('v' + d.oc_version) : '未安装';
		oc.$('oc-st-plugin').textContent = d.plugin_version ? ('v' + d.plugin_version) : '-';

		var pathEl = oc.$('oc-st-path');
		if (d.install_path)
			pathEl.innerHTML = '<code style="padding:2px 8px;background:#f0f3f6;border-radius:4px;font-size:12px;">' + d.install_path + '</code>';
		else
			pathEl.textContent = '-';

		var diskEl = oc.$('oc-st-disk');
		if (d.disk_free)
			diskEl.innerHTML = '<span style="color:#1a7f37;font-weight:500;">' + d.disk_free + '</span> 可用';
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

		infoEl.innerHTML = '⏳ 正在检测空间...';
		api.checkSystem(path).then(function(r) {
			if (r.disk_ok) {
				infoEl.innerHTML = '<span style="color:#1a7f37;">✅ 可用空间: ' + r.disk_free_str +
					' (检测路径: ' + r.disk_path + ')</span>';
			}
			else {
				infoEl.innerHTML = '<span style="color:#cf222e;">❌ 空间不足: ' + r.disk_mb +
					' MB 可用，需要 ≥ 2048 MB (检测路径: ' + r.disk_path + ')</span>';
			}
		}).catch(function() {
			infoEl.innerHTML = '<span style="color:#e36209;">⚠️ 检测失败</span>';
		});
	},

	confirmSetup: function() {
		var self = this;
		var btn = oc.$('btn-setup');
		var pathEl = oc.$('oc-install-path');
		var installPath = pathEl.value.trim() || '/opt';

		btn.disabled = true;
		btn.textContent = '⏳ 检测系统配置...';

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
			titleEl.textContent = '📋 安装日志';
			logEl.textContent = '';
			logEl.textContent += '════════════════════════════════════════\n';
			logEl.textContent += '🔍 系统配置检测\n';
			logEl.textContent += '════════════════════════════════════════\n';
			logEl.textContent += '安装路径: ' + r.install_path + '\n';
			logEl.textContent += '内存: ' + r.memory_mb + ' MB (需要 ≥ 1024 MB) — ' + (r.memory_ok ? '✅ 通过' : '❌ 不达标') + '\n';
			logEl.textContent += '磁盘: ' + r.disk_mb + ' MB 可用 (需要 ≥ 2048 MB) — ' + (r.disk_ok ? '✅ 通过' : '❌ 不达标') + '\n';
			logEl.textContent += '\n';

			if (!r.pass) {
				self.closeSetupDialog();
				btn.disabled = false;
				btn.textContent = '📦 安装运行环境';
				statusEl.innerHTML = '<span style="color:#cf222e;">❌ 系统配置不满足要求</span>';
				logEl.textContent += '❌ 系统配置不满足要求，安装已终止\n';
				logEl.textContent += '💡 请升级硬件配置或清理磁盘空间后重试\n';
				resultEl.style.display = 'block';
				resultEl.innerHTML = '<div style="border:1px solid #f5c6cb;background:#ffeef0;padding:12px 16px;border-radius:6px;">' +
					'<strong style="color:#cf222e;font-size:14px;">❌ 系统配置不满足要求</strong><br/>' +
					'<div style="margin-top:8px;font-size:12px;color:#666;">💡 请升级硬件配置或清理磁盘空间后重试。</div></div>';
				return;
			}

			statusEl.innerHTML = '<span style="color:#7aa2f7;">⏳ 安装进行中...</span>';
			logEl.textContent += '✅ 系统配置检测通过，开始安装...\n\n';
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
			btn.textContent = '📦 安装运行环境';
			alert('系统检测失败，请重试');
		});
	},

	startSetup: function(version, installPath) {
		var self = this;
		var btn = oc.$('btn-setup');
		var logEl = oc.$('setup-log-content');
		var statusEl = oc.$('setup-log-status');

		btn.disabled = true;
		btn.textContent = '⏳ 安装中...';
		statusEl.innerHTML = '<span style="color:#7aa2f7;">⏳ 安装进行中...</span>';
		logEl.textContent += '════════════════════════════════════════\n';
		logEl.textContent += '📦 安装运行环境 (' + ((version === 'stable') ? '稳定版' : '最新版') + ')\n';
		logEl.textContent += '════════════════════════════════════════\n';
		logEl.textContent += '安装路径: ' + installPath + '\n';
		logEl.textContent += '正在启动安装...\n';

		this._autoScroll = oc.bindAutoScroll(logEl);
		this._autoScroll.forceBottom();
		this._lastLogLen = logEl.textContent.length;

		api.service.setup(version, installPath).then(function() {
			self.pollSetupLog();
		}).catch(function(e) {
			statusEl.innerHTML = '<span style="color:#cf222e;">❌ 启动安装失败</span>';
			btn.disabled = false;
			btn.textContent = '📦 安装运行环境';
			alert('启动安装失败: ' + (e.message || e));
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
					statusEl.innerHTML = '<span style="color:#7aa2f7;">⏳ 安装进行中...</span>';
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
		btn.textContent = '📦 安装运行环境';
		resultEl.style.display = 'block';

		if (ok) {
			statusEl.innerHTML = '<span style="color:#1a7f37;">✅ 安装完成</span>';
			resultEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#1a7f37;font-size:14px;">🎉 恭喜！OpenClaw 运行环境安装成功！</strong><br/>' +
				'<span style="color:#555;font-size:13px;line-height:1.8;">服务已自动启用并启动，点击下方按钮刷新页面查看运行状态。</span><br/>' +
				'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-setup" style="margin-top:10px;">🔄 刷新页面</button></div>';
			oc.$('btn-reload-after-setup').addEventListener('click', function() { location.reload(); });
		}
		else {
			statusEl.innerHTML = '<span style="color:#cf222e;">❌ 安装失败</span>';
			var reasons = oc.analyzeFailure(log);
			resultEl.innerHTML = '<div style="border:1px solid #f5c6cb;background:#ffeef0;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#cf222e;font-size:14px;">❌ 安装失败</strong><br/>' +
				'<div style="margin:8px 0;padding:10px 14px;background:#fff5f5;border-radius:4px;font-size:13px;line-height:1.8;">' +
				'<strong>🔍 可能的失败原因：</strong><br/>' + reasons + '</div>' +
				'<div style="margin-top:8px;font-size:12px;color:#666;">💡 完整日志见上方终端输出，也可在终端查看：<code>cat /tmp/openclaw-setup.log</code></div></div>';
		}
	},

	/* ── 普通服务操作 ── */
	serviceCtl: function(action) {
		var self = this;
		var el = oc.$('action-result');

		el.innerHTML = '<span style="color:#999">⏳ 正在执行...</span>';
		if (action === 'restart')
			api.service.restart().then(apply).catch(fail);
		else
			api.service.stop().then(apply).catch(fail);

		function apply(r) {
			if (r.status === 'ok')
				el.innerHTML = '<span style="color:green">✅ ' + action + ' 已完成</span>';
			else
				el.innerHTML = '<span style="color:red">❌ ' + (r.message || '失败') + '</span>';
			self.updateStatusOnceSoon();
		}
		function fail(e) {
			el.innerHTML = '<span style="color:red">❌ 错误</span>';
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
			btn.textContent = '⏳ 正在检测...';
		}
		el.textContent = '';
		act.style.display = 'none';

		api.checkUpdate().then(function(r) {
			btn.disabled = false;
			btn.textContent = '🔍 检测升级';
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
					msgs.push('<span class="ver-badge-new">🔌 插件有新版</span> v' + r.plugin_current + ' → <span class="ver-tag">v' + r.plugin_latest + '</span>');
				else if (r.plugin_latest)
					msgs.push('<span class="ver-badge-latest">🔌 插件已是最新</span> v' + r.plugin_current);
				else
					msgs.push('<span class="ver-badge-unknown">🔌 插件无法检查</span> v' + r.plugin_current);
			}
			if (r.openclaw_current) {
				if (r.openclaw_has_update)
					msgs.push('<span class="ver-badge-new">🦞 核心有新版</span> v' + r.openclaw_current + ' → <span class="ver-tag">v' + r.openclaw_latest + '</span>');
				else if (r.openclaw_latest)
					msgs.push('<span class="ver-badge-latest">🦞 核心已是最新</span> v' + r.openclaw_current);
				else
					msgs.push('<span class="ver-badge-unknown">🦞 核心无法检查</span> v' + r.openclaw_current);
			}
			if (msgs.length === 0)
				msgs.push('<span class="ver-badge-unknown">无法获取版本信息</span>');

			el.innerHTML = msgs.join('<br/>');

			if (r.plugin_has_update || r.openclaw_has_update) {
				act.style.display = 'block';
				self._pluginLatestVer = r.plugin_latest;
				self._coreLatestVer = r.openclaw_latest;

				var notesHtml = '';
				if (r.plugin_has_update && r.release_notes)
					notesHtml = '<div style="margin:12px 0;border:1px solid #d0d7de;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">' +
						'<div style="background:linear-gradient(135deg,#f6f8fa 0%,#ffffff 100%);padding:12px 16px;border-bottom:1px solid #d0d7de;display:flex;align-items:center;justify-content:space-between;">' +
						'<span style="font-size:14px;font-weight:600;color:#24292f;">📋 插件更新日志</span>' +
						'<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:linear-gradient(135deg,#e3f2fd 0%,#bbdefb 100%);color:#1565c0;border:1px solid #64b5f6;">v' + r.plugin_latest + '</span></div>' +
						'<div style="padding:16px;max-height:450px;overflow-y:auto;background:#fff;">' + oc.markdownToHtml(r.release_notes) + '</div></div>';

				var actBtns = '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">';
				if (r.plugin_has_update)
					actBtns += '<button class="btn cbi-button cbi-button-apply" type="button" id="btn-plugin-upgrade" style="box-shadow:0 2px 4px rgba(0,0,0,0.1);">⬆️ 一键升级插件 (v' + r.plugin_latest + ')</button>' +
						'<a href="https://github.com/10000ge10000/luci-app-openclaw/releases/latest" target="_blank" rel="noopener" class="btn cbi-button cbi-button-action" style="text-decoration:none;">📥 GitHub 下载</a>';
				if (r.openclaw_has_update)
					actBtns += '<button class="btn cbi-button cbi-button-apply" type="button" id="btn-core-upgrade" style="background:#d97706;border-color:#b45309;color:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.1);">⬆️ 一键升级 OpenClaw 核心 (v' + r.openclaw_latest + ')</button>';
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
			btn.textContent = '🔍 检测升级';
			if (!silent)
				el.innerHTML = '<span style="color:red">❌ 检测失败</span>';
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

		if (!confirm('确定要将 OpenClaw 核心升级到 v' + ver + '？\n\n升级将执行安全事务：自动全量备份状态、SQLite 数据库预检与配置平滑迁移。'))
			return;

		var btn = oc.$('btn-core-upgrade');
		var panel = oc.$('setup-log-panel');
		var logEl = oc.$('setup-log-content');
		var titleEl = oc.$('setup-log-title');
		var statusEl = oc.$('setup-log-status');
		var resultEl = oc.$('setup-log-result');

		if (btn) {
			btn.disabled = true;
			btn.textContent = '⏳ 正在启动核心升级...';
		}
		panel.style.display = 'block';
		logEl.textContent = '正在启动 OpenClaw 核心升级事务...\n';
		titleEl.textContent = '📋 OpenClaw 核心升级日志';
		statusEl.innerHTML = '<span style="color:#7aa2f7;">⏳ 核心升级中 (执行状态机事务)...</span>';
		resultEl.style.display = 'none';

		this._autoScroll = oc.bindAutoScroll(logEl);
		this._autoScroll.forceBottom();

		api.service.coreUpgrade(ver).then(function() {
			self.pollSetupLog();
		}).catch(function(e) {
			statusEl.innerHTML = '<span style="color:#cf222e;">❌ 启动升级失败</span>';
			alert('启动核心升级失败: ' + (e.message || e));
		});
	},

	/* 插件一键升级 */
	pluginUpgrade: function() {
		var self = this;
		var ver = this._pluginLatestVer;

		if (!ver) {
			alert('无法获取最新版本号');
			return;
		}
		if (!confirm('确定要升级插件到 v' + ver + '？\n\n升级会替换插件文件并清除 LuCI 缓存，不会影响正在运行的 OpenClaw 服务。'))
			return;

		var btn = oc.$('btn-plugin-upgrade');
		var panel = oc.$('setup-log-panel');
		var logEl = oc.$('setup-log-content');
		var titleEl = oc.$('setup-log-title');
		var statusEl = oc.$('setup-log-status');
		var resultEl = oc.$('setup-log-result');

		btn.disabled = true;
		btn.textContent = '⏳ 正在升级插件...';
		panel.style.display = 'block';
		logEl.textContent = '正在启动插件升级...\n';
		titleEl.textContent = '📋 插件升级日志';
		statusEl.innerHTML = '<span style="color:#7aa2f7;">⏳ 插件升级中...</span>';
		resultEl.style.display = 'none';

		this._autoScroll = oc.bindAutoScroll(logEl);
		this._autoScroll.forceBottom();

		api.pluginUpgrade(ver).then(function() {
			self.pollPluginUpgradeLog();
		}).catch(function(e) {
			statusEl.innerHTML = '<span style="color:#cf222e;">❌ 启动升级失败</span>';
			alert('启动插件升级失败: ' + (e.message || e));
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
					statusEl.innerHTML = '<span style="color:#7aa2f7;">⏳ 插件升级中...</span>';
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
			btn.textContent = '⬆️ 升级插件';
		}
		resultEl.style.display = 'block';

		if (ok) {
			statusEl.innerHTML = '<span style="color:#1a7f37;">✅ 插件升级完成</span>';
			resultEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#1a7f37;font-size:14px;">🎉 插件升级成功！</strong><br/>' +
				'<span style="color:#555;font-size:13px;line-height:1.8;">插件文件已更新，OpenClaw 服务不受影响。请刷新页面加载新版界面。</span><br/>' +
				'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-plugin" style="margin-top:10px;">🔄 刷新页面</button></div>';
			oc.$('btn-reload-after-plugin').addEventListener('click', function() { location.reload(); });
		}
		else {
			statusEl.innerHTML = '<span style="color:#cf222e;">❌ 插件升级失败</span>';
			resultEl.innerHTML = '<div style="border:1px solid #f5c6cb;background:#ffeef0;padding:12px 16px;border-radius:6px;">' +
				'<strong style="color:#cf222e;font-size:14px;">❌ 插件升级失败</strong><br/>' +
				'<span style="color:#555;font-size:13px;">请查看上方日志了解详情。也可手动执行：<code>cat /tmp/openclaw-plugin-upgrade.log</code></span><br/>' +
				'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-plugin-fail" style="margin-top:10px;">🔄 刷新页面</button></div>';
			oc.$('btn-reload-after-plugin-fail').addEventListener('click', function() { location.reload(); });
		}
	},

	/* ── 卸载运行环境 ── */
	doUninstall: function() {
		var self = this;

		if (!confirm('确定要卸载 OpenClaw 运行环境？\n\n将删除 Node.js、OpenClaw 程序及配置数据，服务将停止运行。\n\n插件本身不会被删除，之后可重新安装运行环境。'))
			return;

		var btn = oc.$('btn-uninstall');
		var el = oc.$('action-result');

		btn.disabled = true;
		btn.textContent = '⏳ 正在卸载...';
		el.innerHTML = '<span style="color:#999">正在停止服务并清理文件...</span>';

		api.uninstall().then(function(r) {
			btn.disabled = false;
			btn.textContent = '🗑️ 卸载环境';
			if (r.status === 'ok') {
				el.innerHTML = '<div style="border:1px solid #d0d7de;background:#f6f8fa;padding:12px 16px;border-radius:6px;">' +
					'<strong style="color:#1a7f37;">✅ 卸载完成</strong><br/>' +
					'<span style="color:#555;font-size:13px;">' + r.message + '</span><br/>' +
					'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-uninstall" style="margin-top:8px;">🔄 刷新页面</button></div>';
				oc.$('btn-reload-after-uninstall').addEventListener('click', function() { location.reload(); });
			}
			else {
				el.innerHTML = '<span style="color:red">❌ ' + (r.message || '卸载失败') + '</span>';
			}
		}).catch(function(e) {
			btn.disabled = false;
			btn.textContent = '🗑️ 卸载环境';
			el.innerHTML = '<span style="color:red">❌ 请求失败</span>';
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

		el.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">⏳ 加载备份列表...</div>';

		api.backup('list', '', '').then(function(r) {
			if (r.status === 'ok' && r.backups && r.backups.length > 0) {
				var h = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
				h += '<tr style="background:#f6f8fa;border-bottom:2px solid #d0d7de;">' +
					'<th style="padding:6px 8px;text-align:left;">类型</th>' +
					'<th style="padding:6px 8px;text-align:left;">备份时间</th>' +
					'<th style="padding:6px 8px;text-align:right;">大小</th>' +
					'<th style="padding:6px 8px;text-align:center;">操作</th></tr>';

				for (var i = 0; i < r.backups.length; i++) {
					var b = r.backups[i];
					var typeBadge = (b.backup_type === 'config')
						? '<span style="background:#ddf4ff;color:#0969da;padding:2px 6px;border-radius:3px;font-size:11px;white-space:nowrap;">📄 仅配置</span>'
						: '<span style="background:#fff8c5;color:#9a6700;padding:2px 6px;border-radius:3px;font-size:11px;white-space:nowrap;">📦 完整备份</span>';
					var rowBg = (i % 2 === 0) ? '#fff' : '#f6f8fa';
					h += '<tr style="border-bottom:1px solid #eee;background:' + rowBg + ';">' +
						'<td style="padding:7px 8px;">' + typeBadge + '</td>' +
						'<td style="padding:7px 8px;color:#555;white-space:nowrap;">' + oc.escapeHtml(b.time) + '</td>' +
						'<td style="padding:7px 8px;text-align:right;color:#666;white-space:nowrap;">' + oc.escapeHtml(b.size_str) + '</td>' +
						'<td style="padding:5px 8px;text-align:center;white-space:nowrap;">' +
						'<button class="btn cbi-button cbi-button-action" style="font-size:11px;padding:1px 8px;margin-right:4px;" data-act="restore" data-file="' + oc.escapeHtml(b.filename) + '">恢复</button>' +
						'<button class="btn cbi-button cbi-button-remove" style="font-size:11px;padding:1px 8px;" data-act="delete" data-file="' + oc.escapeHtml(b.filename) + '">删除</button>' +
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
				el.innerHTML = '<div style="color:#888;font-size:12px;padding:8px;text-align:center;">暂无备份，请先创建备份</div>';
			}
			else {
				el.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">⚠️ ' + (r.message || '获取列表失败') + '</div>';
			}
		}).catch(function(e) {
			el.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">⚠️ 无法加载列表</div>';
		});
	},

	doBackup: function(onlyConfig) {
		var resEl = oc.$('oc-backup-result');
		var btnC = oc.$('btn-bk-config');
		var btnF = oc.$('btn-bk-full');

		btnC.disabled = true;
		btnF.disabled = true;
		resEl.style.display = 'block';
		resEl.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">⏳ 正在创建备份...' +
			(onlyConfig ? '（仅配置）' : '（完整备份，可能需要较长时间）') + '</div>';

		api.backup('create', onlyConfig ? '1' : '0', '').then(function(r) {
			btnC.disabled = false;
			btnF.disabled = false;
			if (r.status === 'ok') {
				resEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:10px 14px;border-radius:6px;font-size:12px;">' +
					'<strong style="color:#1a7f37;">✅ 备份完成</strong></div>';
				this_loadBackupList();
			}
			else {
				resEl.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">⚠️ ' + (r.message || '备份失败') + '</div>';
			}
			this_loadBackupList();
		}).catch(function(e) {
			btnC.disabled = false;
			btnF.disabled = false;
			resEl.innerHTML = '<div style="color:#e36209;font-size:12px;padding:8px;">⚠️ 备份功能需要 OpenClaw v2026.3.8+</div>';
		});

		var self = this;
		function this_loadBackupList() {
			self.loadBackupList();
		}
	},

	restoreBackup: function(filename) {
		var self = this;

		if (!confirm('确定要从此备份恢复配置？\n\n' + filename + '\n\n当前 openclaw.json 将被备份中的版本覆盖，服务将自动重启。'))
			return;

		var resEl = oc.$('oc-backup-result');
		resEl.style.display = 'block';
		resEl.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">⏳ 正在恢复配置...</div>';

		api.backup('restore', '', filename).then(function(r) {
			if (r.status === 'ok') {
				resEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:10px 14px;border-radius:6px;font-size:12px;">' +
					'<strong style="color:#1a7f37;">✅ 配置已恢复</strong><br/>' +
					'<span style="color:#555;">' + r.message + '</span><br/>' +
					'<button class="btn cbi-button cbi-button-apply" type="button" id="btn-reload-after-restore" style="margin-top:6px;font-size:12px;">🔄 刷新页面</button></div>';
				oc.$('btn-reload-after-restore').addEventListener('click', function() { location.reload(); });
			}
			else {
				resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">❌ ' + (r.message || '恢复失败') + '</div>';
			}
		}).catch(function(e) {
			resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">❌ 恢复失败，请检查日志</div>';
		});
	},

	deleteBackup: function(filename) {
		var self = this;

		if (!confirm('确定要删除此备份？\n\n' + filename + '\n\n删除后无法恢复。'))
			return;

		var resEl = oc.$('oc-backup-result');
		resEl.style.display = 'block';
		resEl.innerHTML = '<div style="color:#7aa2f7;font-size:12px;padding:8px;">⏳ 正在删除...</div>';

		api.backup('delete', '', filename).then(function(r) {
			if (r.status === 'ok') {
				resEl.innerHTML = '<div style="border:1px solid #c6e9c9;background:#e6f7e9;padding:10px 14px;border-radius:6px;font-size:12px;">' +
					'<strong style="color:#1a7f37;">✅ ' + r.message + '</strong></div>';
			}
			else {
				resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">❌ ' + (r.message || '删除失败') + '</div>';
			}
			self.loadBackupList();
		}).catch(function(e) {
			resEl.innerHTML = '<div style="color:#cf222e;font-size:12px;padding:8px;">❌ 删除失败</div>';
		});
	}
});
