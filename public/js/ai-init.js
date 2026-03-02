export async function initAIFeatures(ui, sync, tagEditor) {
	if (window.aiFeaturesInitialized) return;
	window.aiFeaturesInitialized = true;
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
		initTagSuggestions(ui, async () => { 
			if (tagEditor && typeof tagEditor.renderPills === 'function') {
				tagEditor.renderPills(); 
			} else {
				const { tagEditor: activeTagEditor } = await import('./create-post.js');
				if (activeTagEditor) activeTagEditor.renderPills();
			}
			sync(); 
		}),
		initAIWriter(ui, sync),
		initAIRewriter(ui, sync)
	]);
}

if (!window.aiFeaturesListenerAdded) {
	window.aiFeaturesListenerAdded = true;
	window.addEventListener('ai-features-toggled', async (e) => {
		if (e.detail) {
			const { sync, tagEditor } = await import('./create-post.js');
			const { ui } = await import('./ui-elements.js');
			await initAIFeatures(ui, sync, tagEditor);
		}
	});
}
