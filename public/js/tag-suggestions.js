export async function initTagSuggestions(ui, updateCallback) {
	if (!('LanguageModel' in self)) await import('/js/prompt-api-polyfill.js');

	let tagsSchema = null;
	const fetchSchema = async () => {
		if (!tagsSchema) tagsSchema = await (await fetch('/tags-schema.json')).json();
		return tagsSchema;
	};

	try {
		const status = await LanguageModel.availability();
		if (status !== 'unavailable') ui.aiSuggestTagsBtn.style.display = 'inline-block';
	} catch (e) { console.warn("AI LanguageModel availability check failed", e); }

	ui.aiSuggestTagsBtn.onclick = async () => {
		const content = ui.contentInput.value;
		if (!content || content.length < 20) return alert('Write content first.');
		ui.aiSuggestTagsBtn.disabled = true; ui.aiSuggestTagsBtn.textContent = '⏳';
		try {
			const schema = await fetchSchema();
			const session = await LanguageModel.create({
				initialPrompts: [{ role: 'system', content: 'Suggest appropriate tags for this blog post. Only use the tags provided in the schema.' }]
			});
			const response = await session.prompt(`Content: ${content}`, { responseConstraint: schema });
			const suggestedTags = JSON.parse(response).tags;
			if (suggestedTags && suggestedTags.length > 0) {
				ui.tagsInput.value = suggestedTags.join(', ');
				updateCallback();
			}
		} catch (err) {
			console.error(err); alert('Tag suggestion failed.');
		} finally {
			ui.aiSuggestTagsBtn.disabled = false; ui.aiSuggestTagsBtn.textContent = '✨';
		}
	};
}
