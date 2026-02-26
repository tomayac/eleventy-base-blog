import { detectLanguage } from './ai-language-detection.js';
import { customAlert } from './dialog-utils.js';

const getSummarizerOptions = (ui, lang, type) => ({
	type, format: 'plain-text', expectedInputLanguages: [lang], outputLanguage: lang,
	monitor(m) {
		m.addEventListener('downloadprogress', (e) => {
			ui.aiStatus.style.display = 'flex';
			ui.aiDownloadProgress.value = e.loaded; ui.aiDownloadProgress.max = e.total;
			ui.aiStatusText.textContent = `Downloading AI (${lang}): ${Math.round((e.loaded / e.total) * 100)}%`;
			if (e.loaded === e.total) setTimeout(() => ui.aiStatus.style.display = 'none', 2000);
		});
	}
});

async function runSummarizer(ui, type, input, targetInput, updateCallback) {
	if (!input || input.length < 20) return customAlert(ui, 'Please write some content first.');
	const btn = type === 'headline' ? ui.aiSuggestTitleBtn : ui.aiSuggestDescriptionBtn;
	btn.disabled = true; btn.textContent = '⏳'; targetInput.value = '';
	ui.activeAiStreams++;
	try {
		const lang = await detectLanguage(input);
		const options = getSummarizerOptions(ui, lang, type);
		const status = await Summarizer.availability(options);
		if (status === 'unavailable') throw new Error(`Summarizer unavailable for: ${lang}`);
		const summarizer = await Summarizer.create(options);
		const stream = summarizer.summarizeStreaming(input);
		for await (const chunk of stream) {
			targetInput.value += chunk; updateCallback();
		}
		targetInput.value = targetInput.value.trim().replace(/^["']|["']$/g, '');
		if (type === 'headline') targetInput.value = targetInput.value.replace(/\.$/, '');
	} catch (err) { console.error(err); customAlert(ui, 'AI Suggestion failed.'); }
	finally { ui.activeAiStreams--; btn.disabled = false; btn.textContent = '✨'; updateCallback(); }
}

export async function initAI(ui, updateCallback) {
	if (!('Summarizer' in self)) await import('/js/task-apis/summarizer.js');
	if (typeof Summarizer !== 'undefined') {
		try {
			const status = await Summarizer.availability({ type: 'teaser', format: 'plain-text' });
			if (status !== 'unavailable') {
				ui.aiSuggestTitleBtn.style.display = 'flex'; ui.aiSuggestDescriptionBtn.style.display = 'flex';
			}
			if (status === 'downloadable' || status === 'downloading') {
				ui.aiStatus.style.display = 'flex'; ui.aiStatusText.textContent = 'AI model available (needs download)';
			}
		} catch (e) { console.warn("AI Summarizer availability check failed", e); }
	}
	ui.aiSuggestTitleBtn.onclick = () => runSummarizer(ui, 'headline', ui.contentInput.value, ui.titleInput, updateCallback);
	ui.aiSuggestDescriptionBtn.onclick = () => {
		const input = `Title: ${ui.titleInput.value}\n\nContent: ${ui.contentInput.value}`;
		runSummarizer(ui, 'teaser', input, ui.descInput, updateCallback);
	};
}
