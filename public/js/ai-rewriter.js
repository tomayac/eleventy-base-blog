import { detectLanguage } from './ai-language-detection.js';
import { customAlert } from './dialog-utils.js';

const getRewriterOptions = (ui, lang) => ({
	sharedContext: 'The user is rewriting a blog post.',
	tone: ui.aiRewriterTone.value, format: 'markdown', length: ui.aiRewriterLength.value,
	expectedInputLanguages: [lang], outputLanguage: lang,
	monitor(m) {
		m.addEventListener('downloadprogress', (e) => {
			ui.aiStatus.style.display = 'flex';
			ui.aiDownloadProgress.value = e.loaded; ui.aiDownloadProgress.max = e.total;
			ui.aiStatusText.textContent = `Downloading Rewriter (${lang}): ${Math.round((e.loaded / e.total) * 100)}%`;
			if (e.loaded === e.total) setTimeout(() => ui.aiStatus.style.display = 'none', 2000);
		});
	}
});

export async function initAIRewriter(ui, updateCallback) {
	if (!('Rewriter' in self)) await import('/js/task-apis/rewriter.js');
	if (typeof Rewriter !== 'undefined') {
		try {
			const status = await Rewriter.availability({ sharedContext: 'Rewriting a blog post.' });
			if (status !== 'unavailable') ui.aiRewriterBtn.style.display = 'flex';
		} catch (e) { console.warn("AI Rewriter availability check failed", e); }
	}

	ui.aiRewriterBtn.onclick = async () => {
		const fullContent = ui.contentInput.value.trim();
		if (!fullContent) return customAlert(ui, 'Please write some content first.');

		ui.aiRewriterBtn.disabled = true; ui.aiRewriterBtn.textContent = '⏳';
		ui.activeAiStreams++; 
		
		const parts = fullContent.split(/(<figure>[\s\S]*?<\/figure>)/g);
		ui.contentInput.value = '';
		
		try {
			const lang = await detectLanguage(fullContent);
			const options = getRewriterOptions(ui, lang);
			const rewriter = await Rewriter.create(options);
			
			for (const part of parts) {
				if (part.startsWith('<figure>')) {
					ui.contentInput.value = ui.contentInput.value.trimEnd() + '\n\n' + part + '\n\n';
					updateCallback();
				} else if (part.trim()) {
					const stream = rewriter.rewriteStreaming(part);
					for await (const chunk of stream) {
						ui.contentInput.value += chunk;
						updateCallback();
					}
				}
			}
		} catch (err) { console.error(err); customAlert(ui, 'Rewriting failed.'); }
		finally {
			ui.activeAiStreams--;
			ui.aiRewriterBtn.disabled = false;
			ui.aiRewriterBtn.textContent = '✨';
			ui.aiRewriterTone.value = 'as-is';
			ui.aiRewriterLength.value = 'as-is';
			updateCallback();
		}
	};
}
