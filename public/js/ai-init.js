export async function initAIFeatures(ui, sync, tagEditor) {
	const link = document.createElement('link');
	link.rel = 'modulepreload';
	link.href = '/js/ai-multimodal.js';
	document.head.appendChild(link);
	const [{ initAI }, { initTagSuggestions }, { initAIWriter }, { initAIRewriter }] = await Promise.all([
		import('./ai-features.js'),
		import('./ai-tag-suggestions.js'),
		import('./ai-writer.js'),
		import('./ai-rewriter.js')
	]);
	await Promise.all([
		initAI(ui, sync),
		initTagSuggestions(ui, () => { tagEditor.renderPills(); sync(); }),
		initAIWriter(ui, sync),
		initAIRewriter(ui, sync)
	]);
}

window.addEventListener('ai-features-toggled', async (e) => {
	if (e.detail) {
		const { sync, tagEditor } = await import('./create-post.js');
		const { ui } = await import('./ui-elements.js');
		await initAIFeatures(ui, sync, tagEditor);
	}
});
