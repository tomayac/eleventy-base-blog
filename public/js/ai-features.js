import { detectLanguage } from './language-detection.js';

const getSummarizerOptions = (ui, lang, type) => ({
	type, format: 'plain-text', expectedInputLanguages: [lang], outputLanguage: lang,
	monitor(m) {
		m.addEventListener('downloadprogress', (e) => {
			ui.aiStatus.style.visibility = 'visible';
			ui.aiDownloadProgress.value = e.loaded; ui.aiDownloadProgress.max = e.total;
			ui.aiStatusText.textContent = `Downloading AI (${lang}): ${Math.round((e.loaded / e.total) * 100)}%`;
			if (e.loaded === e.total) setTimeout(() => ui.aiStatus.style.visibility = 'hidden', 2000);
		});
	}
});

async function runSummarizer(ui, type, input, targetInput, updateCallback) {
	if (!input || input.length < 20) return alert('Please write some content first.');
	const btn = type === 'headline' ? ui.aiSuggestTitleBtn : ui.aiSuggestDescriptionBtn;
	btn.disabled = true; btn.textContent = '⏳';
	targetInput.value = ''; // Initialize field
	try {
		const lang = await detectLanguage(input);
		const options = getSummarizerOptions(ui, lang, type);
		const summarizer = await Summarizer.create(options);
		const stream = summarizer.summarizeStreaming(input);
		for await (const chunk of stream) {
			// Concatenate chunks exactly as requested
			targetInput.value += chunk;
			updateCallback();
		}
		// Final cleanup: remove potential wrapping quotes from AI
		targetInput.value = targetInput.value.trim().replace(/^["']|["']$/g, '');
		updateCallback();
	} catch (err) { console.error(err); alert('AI Suggestion failed.'); }
	finally { btn.disabled = false; btn.textContent = '✨'; }
}

export async function initAI(ui, updateCallback) {
	if (!('Summarizer' in self)) await import('/js/task-apis/summarizer.js');
	if (typeof Summarizer !== 'undefined') {
		try {
			const status = await Summarizer.availability({ type: 'teaser', format: 'plain-text' });
			if (status !== 'unavailable') {
				ui.aiSuggestTitleBtn.style.display = 'flex';
				ui.aiSuggestDescriptionBtn.style.display = 'flex';
			}
			if (status === 'downloadable' || status === 'downloading') {
				ui.aiStatus.style.visibility = 'visible'; ui.aiStatusText.textContent = 'AI model available (needs download)';
			}
		} catch (e) { console.warn("AI Summarizer availability check failed", e); }
	}
	ui.aiSuggestTitleBtn.onclick = () => runSummarizer(ui, 'headline', ui.contentInput.value, ui.titleInput, updateCallback);
	ui.aiSuggestDescriptionBtn.onclick = () => {
		const input = `Title: ${ui.titleInput.value}\n\nContent: ${ui.contentInput.value}`;
		runSummarizer(ui, 'teaser', input, ui.descInput, updateCallback);
	};
}
