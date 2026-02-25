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

	const savedPreference = localStorage.getItem('ai-features-enabled');
	const isEnabled = savedPreference === null ? true : savedPreference === 'true';
	ui.aiFeaturesToggle.checked = isEnabled;
	setBtnAvailable();
	updateVisibility(isEnabled);

	ui.aiFeaturesToggle.addEventListener('change', () => {
		const enabled = ui.aiFeaturesToggle.checked;
		localStorage.setItem('ai-features-enabled', enabled);
		updateVisibility(enabled);
	});

	window.addEventListener('storage', (e) => {
		if (e.key === 'ai-features-enabled') {
			const enabled = e.newValue === 'true';
			ui.aiFeaturesToggle.checked = enabled;
			updateVisibility(enabled);
		}
	});
}
