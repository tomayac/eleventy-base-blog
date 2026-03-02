import { customAlert } from './dialog-utils.js';
import { aiKeys, updateGlobalConfig, updateBackendFields, getBackendConfigs, saveBackendConfigs } from './ai-config.js';

export function refreshAIVisibility(ui) {
	const enabled = ui.aiFeaturesToggle.checked;
	const aiButtons = Array.from(document.querySelectorAll('.ai-button'));
	const isAiSupported = aiButtons.some(btn => btn?.getAttribute('data-ai-available') === 'true');

	if (ui.aiWriterSection) ui.aiWriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
	if (ui.aiRewriterSection) ui.aiRewriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
	if (!enabled && ui.aiStatus) ui.aiStatus.style.display = 'none';
	if (ui.aiKeysSection) ui.aiKeysSection.style.display = enabled ? 'block' : 'none';
	
	aiButtons.forEach(btn => {
		if (btn) {
			const isAvailable = btn.getAttribute('data-ai-available') === 'true';
			const shouldShow = enabled && isAvailable;
			btn.style.display = shouldShow ? 'flex' : 'none';
			if (btn.parentElement?.classList.contains('input-with-action')) {
				btn.parentElement.style.display = shouldShow ? 'flex' : 'block';
			}
		}
	});
}

export function updateUIFields(ui, configs, aiKeys) {
	const currentBackend = ui.aiBackendSelect.value;
	const currentConfig = configs[currentBackend] || {};
	aiKeys.forEach(id => {
		if (id === 'ai-backend') return;
		const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + (id.includes('toggle') ? '' : (id.includes('provider') || id.includes('backend') || id.includes('device') || id.includes('dtype') ? 'Select' : 'Input'));
		const input = ui[key] || document.getElementById(id);
		if (input) {
			const val = currentConfig[id];
			if (input.type === 'checkbox') input.checked = val === true;
			else if (val !== undefined) input.value = val;
			else input.value = '';
		}
	});
}

export function initAIToggle(ui) {
	const aiKeys = [
		'ai-backend', 'ai-api-key', 'ai-model-name', 'ai-project-id', 'ai-app-id', 
		'ai-gemini-api-provider', 'ai-use-app-check', 'ai-recaptcha-site-key', 
		'ai-use-limited-use-tokens', 'ai-device', 'ai-dtype'
	];
	const configs = getBackendConfigs();
	const backend = localStorage.getItem('ai-backend') || ui.aiBackendSelect.value;
	ui.aiBackendSelect.value = backend;
	updateUIFields(ui, configs, aiKeys);
	ui.aiBackendSelect.onchange = () => { 
		localStorage.setItem('ai-backend', ui.aiBackendSelect.value); 
		updateUIFields(ui, configs, aiKeys);
		updateBackendFields(ui); refreshAIVisibility(ui); updateGlobalConfig(ui); 
	};
	aiKeys.forEach(id => {
		if (id === 'ai-backend') return;
		const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + (id.includes('toggle') ? '' : (id.includes('provider') || id.includes('backend') || id.includes('device') || id.includes('dtype') ? 'Select' : 'Input'));
		const input = ui[key] || document.getElementById(id);
		if (input) {
			input[input.type === 'checkbox' ? 'onchange' : 'oninput'] = () => { 
				const currentBackend = ui.aiBackendSelect.value;
				if (!configs[currentBackend]) configs[currentBackend] = {};
				configs[currentBackend][id] = input.type === 'checkbox' ? input.checked : input.value;
				saveBackendConfigs(configs);
				updateGlobalConfig(ui); 
				if (id === 'ai-use-app-check') updateBackendFields(ui);
			};
		}
	});
	updateBackendFields(ui); updateGlobalConfig(ui);
	ui.aiFeaturesToggle.checked = localStorage.getItem('ai-features-enabled') === 'true';
	ui.aiOnlyExistingTagsToggle.checked = localStorage.getItem('ai-only-existing-tags') === 'true';
	refreshAIVisibility(ui);
	ui.aiFeaturesToggle.addEventListener('change', async () => { 
		localStorage.setItem('ai-features-enabled', ui.aiFeaturesToggle.checked); 
		if (ui.aiFeaturesToggle.checked) {
			const { initAIFeatures } = await import('./ai-init.js');
			await initAIFeatures(ui, () => import('./create-post.js').then(m => m.sync()), { renderPills: () => import('./tag-editor.js').then(m => m.renderPills()) });
		}
		refreshAIVisibility(ui); 
		window.dispatchEvent(new CustomEvent('ai-features-toggled', { detail: ui.aiFeaturesToggle.checked }));
	});
	ui.aiOnlyExistingTagsToggle.addEventListener('change', () => { 
		localStorage.setItem('ai-only-existing-tags', ui.aiOnlyExistingTagsToggle.checked); 
	});
}
