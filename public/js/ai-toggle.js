import { customAlert } from './dialog-utils.js';

export function initAIToggle(ui) {
	const aiButtons = Array.from(document.querySelectorAll('.ai-button'));
	const aiKeys = [
		'ai-backend',
		'ai-api-key', 'ai-project-id', 'ai-app-id', 'ai-model-name',
		'gemini-api-key', 'gemini-model-name',
		'openai-api-key', 'openai-model-name',
		'anthropic-api-key', 'anthropic-model-name'
	];
	
	const setBtnAvailable = () => {
		aiButtons.forEach(btn => {
			if (btn && btn.style.display !== 'none') btn.setAttribute('data-ai-available', 'true');
		});
	};

	const updateBackendFields = () => {
		const backend = ui.aiBackendSelect.value;
		document.querySelectorAll('.ai-backend-fields').forEach(el => {
			el.style.display = el.getAttribute('data-backend') === backend ? 'block' : 'none';
		});
	};

	const updateVisibility = (enabled) => {
		const isAiSupported = aiButtons.some(btn => btn?.getAttribute('data-ai-available') === 'true');

		if (ui.aiWriterSection) ui.aiWriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
		if (ui.aiRewriterSection) ui.aiRewriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
		if (!enabled && ui.aiStatus) ui.aiStatus.style.display = 'none';
		if (ui.aiOnlyExistingTagsToggle) ui.aiOnlyExistingTagsToggle.parentElement.style.display = enabled ? 'flex' : 'none';
		if (ui.aiKeysSection) ui.aiKeysSection.style.display = enabled ? 'block' : 'none';
		
		aiButtons.forEach(btn => {
			if (btn) {
				const parent = btn.parentElement;
				const isAvailable = btn.getAttribute('data-ai-available') === 'true';
				const shouldShow = enabled && isAvailable;
				btn.style.display = shouldShow ? 'flex' : 'none';
				if (parent && parent.classList.contains('input-with-action')) {
					parent.style.display = shouldShow ? 'flex' : 'block';
				}
			}
		});

		if (enabled) {
			const backend = ui.aiBackendSelect.value;
			if (backend !== 'native') {
				const backendFields = document.querySelectorAll(`.ai-backend-fields[data-backend="${backend}"] input`);
				const missingKeys = Array.from(backendFields).some(input => !input.value);
				if (missingKeys) {
					ui.settingsDetails.open = true;
					customAlert(ui, 'Please enter your AI API keys in the Settings section to use AI features.');
				}
			}
		}
	};

	const updateGlobalConfig = () => {
		window.FIREBASE_CONFIG = {
			apiKey: ui.aiApiKeyInput.value,
			projectId: ui.aiProjectIdInput.value,
			appId: ui.aiAppIdInput.value,
			modelName: ui.aiModelNameInput.value
		};
		// Also update generic keys for other backends if the polyfill supports them directly
		localStorage.setItem('prompt-api-backend', ui.aiBackendSelect.value);
	};

	ui.aiBackendSelect.onchange = () => {
		localStorage.setItem('ai-backend', ui.aiBackendSelect.value);
		updateBackendFields();
		updateVisibility(ui.aiFeaturesToggle.checked);
		updateGlobalConfig();
	};

	aiKeys.forEach(id => {
		const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Input';
		const input = ui[key] || document.getElementById(id);
		if (input) {
			if (input.tagName === 'SELECT') {
				input.value = localStorage.getItem(id) || 'native';
			} else {
				input.value = localStorage.getItem(id) || '';
			}
			input.oninput = () => {
				localStorage.setItem(id, input.value);
				updateGlobalConfig();
			};
		}
	});

	updateBackendFields();
	updateGlobalConfig();

	const savedAiEnabled = localStorage.getItem('ai-features-enabled');
	const aiEnabled = savedAiEnabled === null ? true : savedAiEnabled === 'true';
	ui.aiFeaturesToggle.checked = aiEnabled;

	const savedOnlyExisting = localStorage.getItem('ai-only-existing-tags');
	const onlyExisting = savedOnlyExisting === 'true';
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
		} else if (aiKeys.includes(e.key)) {
			const key = e.key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Input';
			const input = ui[key] || document.getElementById(e.key);
			if (input) input.value = e.newValue || '';
			if (e.key === 'ai-backend') updateBackendFields();
			updateGlobalConfig();
		}
	});
}
