import { detectLanguage } from './language-detection.js';

export async function initAI(ui, updateCallback) {
	if (!('Summarizer' in self)) await import('/js/task-apis/summarizer.js');

	const getSummarizerOptions = (lang) => ({
		type: 'headline',
		format: 'plain-text',
		expectedInputLanguages: [lang],
		outputLanguage: lang,
		monitor(m) {
			m.addEventListener('downloadprogress', (e) => {
				ui.aiStatus.style.display = 'block';
				ui.aiDownloadProgress.value = e.loaded;
				ui.aiDownloadProgress.max = e.total;
				ui.aiStatusText.textContent = `Downloading AI model (${lang}): ${Math.round((e.loaded / e.total) * 100)}%`;
				if (e.loaded === e.total) setTimeout(() => ui.aiStatus.style.display = 'none', 2000);
			});
		}
	});

	if (typeof Summarizer !== 'undefined') {
		try {
			// Check availability with a default language first to show the button
			const status = await Summarizer.availability({ type: 'headline', format: 'plain-text' });
			if (status !== 'unavailable') ui.aiSuggestTitleBtn.style.display = 'inline-block';
			if (status === 'downloadable' || status === 'downloading') {
				ui.aiStatus.style.display = 'block';
				ui.aiStatusText.textContent = 'AI model available (needs download)';
			}
		} catch (e) { console.warn("AI Summarizer availability check failed", e); }
	}

	ui.aiSuggestTitleBtn.onclick = async () => {
		const content = ui.contentInput.value;
		if (!content || content.length < 20) return alert('Please write some content first.');

		ui.aiSuggestTitleBtn.disabled = true;
		ui.aiSuggestTitleBtn.textContent = '⏳';

		try {
			const lang = await detectLanguage(content);
			const options = getSummarizerOptions(lang);
			
			// Re-verify availability for specific language as per SKILL.md
			const status = await Summarizer.availability(options);
			if (status === 'unavailable') throw new Error(`Summarizer unavailable for language: ${lang}`);

			const summarizer = await Summarizer.create(options);
			const suggestion = await summarizer.summarize(content);
			
			if (suggestion) {
				ui.titleInput.value = suggestion.trim().replace(/^["']|["']$/g, '');
				updateCallback();
			}
		} catch (err) {
			console.error(err);
			alert('AI Suggestion failed.');
		} finally {
			ui.aiSuggestTitleBtn.disabled = false;
			ui.aiSuggestTitleBtn.textContent = '✨';
		}
	};
}
