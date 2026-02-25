export function initAIToggle(ui) {
	// Identify available features
	[ui.aiSuggestTitleBtn, ui.aiSuggestDescriptionBtn, ui.aiSuggestTagsBtn, ui.aiWriterBtn].forEach(btn => {
		if (btn && btn.style.display !== 'none') {
			btn.setAttribute('data-ai-available', 'true');
		}
	});

	const updateVisibility = (enabled) => {
		const isAiSupported = [ui.aiSuggestTitleBtn, ui.aiSuggestDescriptionBtn, ui.aiSuggestTagsBtn, ui.aiWriterBtn]
			.some(btn => btn.getAttribute('data-ai-available') === 'true');

		// Hide section if disabled OR not supported
		if (ui.aiWriterSection) {
			ui.aiWriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
		}
		
		// Status bar only shows when downloading, but we hide it completely if disabled
		if (!enabled && ui.aiStatus) ui.aiStatus.style.display = 'none';
		
		[ui.aiSuggestTitleBtn, ui.aiSuggestDescriptionBtn, ui.aiSuggestTagsBtn].forEach(btn => {
			if (btn) {
				const parent = btn.parentElement;
				const isAvailable = btn.getAttribute('data-ai-available') === 'true';
				const shouldShow = enabled && isAvailable;
				btn.style.display = shouldShow ? 'flex' : 'none';
				if (parent.classList.contains('input-with-action')) {
					parent.style.display = shouldShow ? 'flex' : 'block';
				}
			}
		});

		// Specialized handling for writer button within its section
		if (ui.aiWriterBtn) {
			const isAvailable = ui.aiWriterBtn.getAttribute('data-ai-available') === 'true';
			ui.aiWriterBtn.style.display = (enabled && isAvailable) ? 'flex' : 'none';
		}
	};

	const savedPreference = localStorage.getItem('ai-features-enabled');
	const isEnabled = savedPreference === null ? true : savedPreference === 'true';
	
	ui.aiFeaturesToggle.checked = isEnabled;
	updateVisibility(isEnabled);

	ui.aiFeaturesToggle.addEventListener('change', () => {
		const enabled = ui.aiFeaturesToggle.checked;
		localStorage.setItem('ai-features-enabled', enabled);
		updateVisibility(enabled);
	});
}
