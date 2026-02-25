import { detectLanguage } from './language-detection.js';
import { customAlert } from './dialog-utils.js';

const getWriterOptions = (ui, lang) => ({
	sharedContext: 'The user provides a few bullet points. Expand them into a detailed blog post.',
	expectedInputLanguages: [lang], outputLanguage: lang,
	monitor(m) {
		m.addEventListener('downloadprogress', (e) => {
			ui.aiStatus.style.display = 'flex';
			ui.aiDownloadProgress.value = e.loaded; ui.aiDownloadProgress.max = e.total;
			ui.aiStatusText.textContent = `Downloading Writer (${lang}): ${Math.round((e.loaded / e.total) * 100)}%`;
			if (e.loaded === e.total) setTimeout(() => ui.aiStatus.style.display = 'none', 2000);
		});
	}
});

export async function initAIWriter(ui, updateCallback) {
	if (!('Writer' in self)) await import('/js/task-apis/writer.js');
	if (typeof Writer !== 'undefined') {
		try {
			const status = await Writer.availability();
			if (status !== 'unavailable') ui.aiWriterBtn.style.display = 'flex';
		} catch (e) { console.warn("AI Writer availability check failed", e); }
	}

	ui.aiWriterBtn.onclick = async () => {
		const input = ui.aiWriterInput.value.trim();
		if (!input) return customAlert(ui, 'Please write some content first.');
		ui.aiWriterBtn.disabled = true; ui.aiWriterBtn.textContent = '⏳';
		let fullResponse = '';
		try {
			const textToDetect = ui.contentInput.value.length > 20 ? ui.contentInput.value : input;
			const lang = await detectLanguage(textToDetect);
			const options = getWriterOptions(ui, lang);
			const status = await Writer.availability(options);
			if (status === 'unavailable') throw new Error(`Writer unavailable for: ${lang}`);
			const writer = await Writer.create(options);
			const stream = writer.writeStreaming(input);
			ui.contentInput.value = '';
			for await (const chunk of stream) {
				fullResponse += chunk; ui.contentInput.value = fullResponse; updateCallback();
			}
		} catch (err) { console.error(err); customAlert(ui, 'Expansion failed.'); }
		finally { ui.aiWriterBtn.disabled = false; ui.aiWriterBtn.textContent = '✨'; }
	};
}
