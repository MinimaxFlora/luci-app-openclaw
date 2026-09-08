'use strict';

/**
 * openclaw.common — shared UI helpers for the OpenClaw views.
 * Every helper is ported 1:1 from the legacy pages (status.htm / basic.lua /
 * wechat.htm / console.htm / advanced.htm) so rendering & behavior match.
 */
const common = {};

/** HTML escaping (console.htm / advanced.htm escapeHtml) */
common.escapeHtml = function(str) {
	return String(str || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};

/** pull the wechat login link out of raw log text (wechat.htm extractWechatLoginUrl) */
common.extractWechatLoginUrl = function(text) {
	if (!text)
		return '';

	var matches = text.match(/https?:\/\/[^\s\]})"'<>]+/g) || [];
	var fallback = '';

	for (var i = 0; i < matches.length; i++) {
		var url = matches[i];

		if (/liteapp\.weixin\.qq\.com\/q\//.test(url) || /weixin\.qq\.com\/q\//.test(url))
			fallback = url;
		else if (!/ilinkai\.weixin\.qq\.com/.test(url))
			fallback = url;
	}

	return fallback;
};

/** copy text to clipboard with legacy fallback (wechat.htm ocCopyToClipboard) */
common.copyToClipboard = function(text, btn) {
	var done = function() {
		btn.textContent = _('Copied');
		btn.classList.add('copied');
		setTimeout(function() {
			btn.textContent = _('Copy');
			btn.classList.remove('copied');
		}, 2000);
	};

	var fail = function() {
		common._fallbackCopy(text, btn, done);
	};

	if (navigator.clipboard && navigator.clipboard.writeText)
		navigator.clipboard.writeText(text).then(done).catch(fail);
	else
		fail();
};

common._fallbackCopy = function(text, btn, done) {
	var input = document.createElement('input');

	input.style.position = 'fixed';
	input.style.left = '-9999px';
	input.value = text;
	document.body.appendChild(input);
	input.select();

	try {
		if (document.execCommand('copy'))
			done();
		else
			alert(_('Copy failed, please copy manually: ') + text);
	}
	catch (e) {
		alert(_('Copy failed, please copy manually: ') + text);
	}

	document.body.removeChild(input);
};

/** smart auto-scroll for log <pre>: pauses when the user scrolls up (basic.lua) */
common.bindAutoScroll = function(el) {
	if (el._ocScrollAttached)
		return el;

	var enabled = true;

	el._ocScrollAttached = true;
	el.addEventListener('scroll', function() {
		var atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 5;

		enabled = atBottom;
	});

	return {
		scroll: function() {
			if (enabled)
				el.scrollTop = el.scrollHeight;
		},
		forceBottom: function() {
			enabled = true;
			el.scrollTop = el.scrollHeight;
		},
		disable: function() {
			enabled = false;
		},
		enable: function() {
			enabled = true;
		}
	};
};

/** GitHub markdown → styled HTML for release notes (basic.lua ocMarkdownToHtml) */
common.markdownToHtml = function(md) {
	if (!md)
		return '';

	var html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

	html = html.replace(/```(\w*)\n([\s\S]*?)```/g,
		function(m, lang, code) {
			return '<pre style="background:#f6f8fa;padding:12px 16px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.6;font-family:SF Mono,Consolas,Menlo,monospace;border:1px solid #d0d7de;"><code>' + code.trim() + '</code></pre>';
		});
	html = html.replace(/`([^`]+)`/g,
		'<code style="background:#f6f8fa;padding:2px 6px;border-radius:4px;font-size:13px;font-family:SF Mono,Consolas,Menlo,monospace;border:1px solid #e1e4e8;">$1</code>');
	html = html.replace(/^#### (.+)$/gm,
		'<h5 style="margin:12px 0 6px;font-size:14px;font-weight:600;color:#1f2328;letter-spacing:-0.02em;">$1</h5>');
	html = html.replace(/^### (.+)$/gm,
		'<h4 style="margin:14px 0 8px;font-size:15px;font-weight:600;color:#1f2328;letter-spacing:-0.02em;">$1</h4>');
	html = html.replace(/^## (.+)$/gm,
		'<h3 style="margin:16px 0 10px;font-size:17px;font-weight:600;color:#1f2328;letter-spacing:-0.02em;">$1</h3>');
	html = html.replace(/^# (.+)$/gm,
		'<h2 style="margin:18px 0 12px;font-size:20px;font-weight:600;color:#1f2328;border-bottom:1px solid #d0d7de;padding-bottom:8px;letter-spacing:-0.02em;">$1</h2>');
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="font-weight:600;">$1</strong>');
	html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
		'<a href="$2" target="_blank" rel="noopener" style="color:#0969da;text-decoration:none;border-bottom:1px solid transparent;transition:border-color 0.2s;">$1</a>');
	html = html.replace(/^[*-] (.+)$/gm,
		'<li style="margin:4px 0 4px 0;padding-left:4px;line-height:1.75;list-style-position:inside;color:#32383f;">$1</li>');
	html = html.replace(/^(\d+)\. (.+)$/gm,
		'<li style="margin:4px 0 4px 0;padding-left:4px;line-height:1.75;list-style-position:inside;color:#32383f;"><span style="color:#656d76;margin-right:4px;">$1.</span>$2</li>');
	html = html.replace(/^(---|\*\*\*)$/gm,
		'<hr style="border:none;border-top:1px solid #d0d7de;margin:16px 0;"/>');
	html = html.replace(/\n\n+/g, '<br/><br/>');
	html = html.replace(/\n/g, '<br/>');

	return '<div style="font-size:14px;line-height:1.75;color:#32383f;font-family:PingFang SC,Microsoft YaHei,Noto Sans SC,sans-serif;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;">' + html + '</div>';
};

/** install failure root-cause analysis (basic.lua ocAnalyzeFailure) */
common.analyzeFailure = function(log) {
	var reasons = [];

	if (!log)
		return _('Unknown error, please check the logs.');

	var ll = log.toLowerCase();

	if (ll.indexOf('could not resolve') >= 0 || ll.indexOf('connection timed out') >= 0 ||
	    (ll.indexOf('curl') >= 0 && ll.indexOf('fail') >= 0) ||
	    (ll.indexOf('wget') >= 0 && ll.indexOf('fail') >= 0) || ll.indexOf('所有镜像均下载失败') >= 0)
		reasons.push(_('🌐 <b>Network connection failed</b> — unable to download Node.js. Make sure the router can reach the internet.<br/>&nbsp;&nbsp;💡 Fix: check DNS settings and connectivity, or point to a mirror manually: <code>NODE_MIRROR=https://npmmirror.com/mirrors/node openclaw-env setup</code>'));

	if (ll.indexOf('no space') >= 0 || ll.indexOf('disk full') >= 0 || ll.indexOf('enospc') >= 0)
		reasons.push(_('💾 <b>Not enough disk space</b> — Node.js + OpenClaw need roughly 200 MB.<br/>&nbsp;&nbsp;💡 Fix: run <code>df -h</code> to check free space, then remove unneeded files or use external storage.'));

	if (ll.indexOf('不支持的 cpu 架构') >= 0 || ll.indexOf('不支持的架构') >= 0)
		reasons.push(_('🔧 <b>Unsupported CPU architecture</b> — only x86_64 and aarch64 (ARM64) are supported.<br/>&nbsp;&nbsp;💡 The device is likely 32-bit ARM or MIPS, which cannot run Node.js 22.'));

	if ((ll.indexOf('npm err') >= 0 || (ll.indexOf('npm warn') >= 0 && ll.indexOf('openclaw 安装验证失败') >= 0)))
		reasons.push(_('📦 <b>npm failed to install OpenClaw</b> — downloading or installing the npm package failed.<br/>&nbsp;&nbsp;💡 Fix: try <code>openclaw-env setup</code> manually or check the network connection.'));

	if (ll.indexOf('permission denied') >= 0 || ll.indexOf('eacces') >= 0)
		reasons.push(_('🔒 <b>Permission denied</b> — file or directory permission problem.<br/>&nbsp;&nbsp;💡 Fix: run <code>openclaw-env setup</code> or retry as root.'));

	if (ll.indexOf('tar') >= 0 && (ll.indexOf('error') >= 0 || ll.indexOf('fail') >= 0))
		reasons.push(_('📂 <b>Extraction failed</b> — the Node.js package may have downloaded incompletely.<br/>&nbsp;&nbsp;💡 Fix: clear the cache and retry <code>openclaw-env setup</code>'));

	if (ll.indexOf('安装验证失败') >= 0)
		reasons.push(_('⚠️ <b>Install verification failed</b> — the program was downloaded but cannot run.<br/>&nbsp;&nbsp;💡 Possibly a glibc/musl mismatch; check the C library type: <code>ldd --version 2>&1 | head -1</code>'));

	if (reasons.length === 0)
		reasons.push(_('⚠️ <b>Unrecognized error</b> — review the full log above for the actual cause.<br/>&nbsp;&nbsp;💡 You can also run <code>openclaw-env setup</code> manually for detailed output.'));

	return reasons.join('<br/><br/>');
};

/** human size (basic backup list) */
common.formatSize = function(size) {
	size = Number(size) || 0;

	if (size >= 1073741824)
		return (size / 1073741824).toFixed(1) + ' GB';
	if (size >= 1048576)
		return (size / 1048576).toFixed(1) + ' MB';
	if (size >= 1024)
		return (size / 1024).toFixed(1) + ' KB';

	return size + ' B';
};

/** element lookup shortcut */
common.$ = function(id) {
	return document.getElementById(id);
};

return common;
