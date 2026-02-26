export function initAIToggle(ui) {
	const setBtnAvailable = () => {
		[ui.aiSuggestTitleBtn, ui.aiSuggestDescriptionBtn, ui.aiSuggestTagsBtn, ui.aiWriterBtn].forEach(btn => {
			if (btn && btn.style.display !== 'none') btn.setAttribute('data-ai-available', 'true');
		});
	};

	const updateVisibility = (enabled) => {
		const isAiSupported = [ui.aiSuggestTitleBtn, ui.aiSuggestDescriptionBtn, ui.aiSuggestTagsBtn, ui.aiWriterBtn]
			.some(btn => btn.getAttribute('data-ai-available') === 'true');
		if (ui.aiWriterSection) ui.aiWriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
		if (!enabled && ui.aiStatus) ui.aiStatus.style.display = 'none';
		if (ui.aiOnlyExistingTagsToggle) ui.aiOnlyExistingTagsToggle.parentElement.style.display = enabled ? 'flex' : 'none';
		
		[ui.aiSuggestTitleBtn, ui.aiSuggestDescriptionBtn, ui.aiSuggestTagsBtn, ui.aiWriterBtn].forEach(btn => {
			if (btn) {
				const parent = btn.parentElement;
				const isAvailable = btn.getAttribute('data-ai-available') === 'true';
				const shouldShow = enabled && isAvailable;
				btn.style.display = shouldShow ? 'flex' : 'none';
				if (parent.classList.contains('input-with-action')) parent.style.display = shouldShow ? 'flex' : 'block';
			}
		});
	};

	const savedAiEnabled = localStorage.getItem('ai-features-enabled');
	const aiEnabled = savedAiEnabled === null ? true : savedAiEnabled === 'true';
	ui.aiFeaturesToggle.checked = aiEnabled;

	const savedOnlyExisting = localStorage.getItem('ai-only-existing-tags');
	const onlyExisting = savedOnlyExisting === 'true'; // false by default
	ui.aiOnlyExistingTagsToggle.checked = onlyExisting;

	setBtnAvailable();
	updateVisibility(aiEnabled);

	ui.aiFeaturesToggle.addEventListener('change', () => {
		localStorage.setItem('ai-features-enabled', ui.aiFeaturesToggle.checked);
		updateVisibility(ui.aiFeaturesToggle.checked);
	});

	ui.aiOnlyExistingTagsToggle.addEventListener('change', () => {
		localStorage.setItem('ai-only-existing-tags', ui.aiOnlyExistingTagsToggle.checked);
	});

	window.addEventListener('storage', (e) => {
		if (e.key === 'ai-features-enabled') {
			ui.aiFeaturesToggle.checked = e.newValue === 'true';
			updateVisibility(ui.aiFeaturesToggle.checked);
		} else if (e.key === 'ai-only-existing-tags') {
			ui.aiOnlyExistingTagsToggle.checked = e.newValue === 'true';
		}
	});
}
