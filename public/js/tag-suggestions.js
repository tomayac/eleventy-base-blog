import { detectLanguage } from './language-detection.js';

export async function initTagSuggestions(ui, updateCallback) {
	if (!('LanguageModel' in self)) await import('/js/prompt-api-polyfill.js');

	let tagsSchema = null;
	const fetchSchema = async () => {
		if (!tagsSchema) tagsSchema = await (await fetch('/tags-schema.json')).json();
		return tagsSchema;
	};

	try {
		const status = await LanguageModel.availability();
		if (status !== 'unavailable') ui.aiSuggestTagsBtn.style.display = 'flex';
	} catch (e) { console.warn("AI LanguageModel availability check failed", e); }

	ui.aiSuggestTagsBtn.onclick = async () => {
		const content = ui.contentInput.value;
		if (!content || content.length < 20) return alert('Write content first.');
		ui.aiSuggestTagsBtn.disabled = true; ui.aiSuggestTagsBtn.textContent = '⏳';
		let fullResponse = '';
		try {
			const lang = await detectLanguage(content);
			const schema = await fetchSchema();
			const options = {
				initialPrompts: [{ role: 'system', content: `Suggest tags for this blog post in ${lang}. Only use the tags provided in the schema.` }]
			};
			const status = await LanguageModel.availability(options);
			if (status === 'unavailable') throw new Error('LanguageModel unavailable');
			const session = await LanguageModel.create(options);
			const stream = session.promptStreaming(`Content: ${content}`, { responseConstraint: schema });
			for await (const chunk of stream) {
				fullResponse += chunk;
				try {
					const suggestedTags = JSON.parse(fullResponse).tags;
					if (suggestedTags && Array.isArray(suggestedTags)) {
						ui.tagsInput.value = suggestedTags.join(', '); updateCallback();
					}
				} catch (e) { /* Partial JSON parsing fails */ }
			}
		} catch (err) { console.error(err); alert('Tag suggestion failed.'); }
		finally { ui.aiSuggestTagsBtn.disabled = false; ui.aiSuggestTagsBtn.textContent = '✨'; }
	};
}
