import { detectLanguage } from './ai-language-detection.js';
import { customAlert, customConfirm } from './dialog-utils.js';

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
			const status = await Writer.availability({
				sharedContext: 'The user provides a few bullet points. Expand them into a detailed blog post.'
			});
			if (status !== 'unavailable') ui.aiWriterBtn.style.display = 'flex';
		} catch (e) { console.warn("AI Writer availability check failed", e); }
	}

	ui.aiWriterBtn.onclick = async () => {
		const input = ui.aiWriterInput.value.trim();
		if (!input) return customAlert(ui, 'Please write some content first.');
		
		let mode = 'replace';
		if (ui.contentInput.value.trim().length > 0) {
			const choice = await customConfirm(ui, 'You already have content. Should the AI replace it or append at the end?', {
				confirmText: 'Append', cancelText: 'Replace'
			});
			if (choice === 'confirm') mode = 'append';
			else if (choice !== 'cancel') return;
		}

		ui.aiWriterBtn.disabled = true; ui.aiWriterBtn.textContent = '⏳';
		ui.activeAiStreams++;
		if (mode === 'replace') ui.contentInput.value = '';
		else ui.contentInput.value = ui.contentInput.value.replace(/\n+$/, '') + '\n\n';
		
		try {
			const lang = await detectLanguage(input);
			const options = getWriterOptions(ui, lang);
			const status = await Writer.availability(options);
			if (status === 'unavailable') throw new Error(`Writer unavailable for: ${lang}`);
			const writer = await Writer.create(options);
			const stream = writer.writeStreaming(input);
			
			for await (const chunk of stream) {
				ui.contentInput.value += chunk;
				updateCallback();
			}
		} catch (err) { console.error(err); customAlert(ui, `Expansion failed. ${err.message}`); }
		finally {
			ui.activeAiStreams--;
			ui.aiWriterBtn.disabled = false;
			ui.aiWriterBtn.textContent = '✨';
			ui.aiWriterInput.value = '';
			updateCallback();
		}
	};
}
