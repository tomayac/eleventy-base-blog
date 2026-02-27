import { customAlert } from './dialog-utils.js';
import { aiKeys, updateGlobalConfig, updateBackendFields } from './ai-config.js';

export function initAIToggle(ui) {
	const aiButtons = Array.from(document.querySelectorAll('.ai-button'));
	const updateVisibility = (enabled) => {
		const isAiSupported = aiButtons.some(btn => btn?.getAttribute('data-ai-available') === 'true');
		if (ui.aiWriterSection) ui.aiWriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
		if (ui.aiRewriterSection) ui.aiRewriterSection.style.display = (enabled && isAiSupported) ? 'block' : 'none';
		if (!enabled && ui.aiStatus) ui.aiStatus.style.display = 'none';
		if (ui.aiKeysSection) ui.aiKeysSection.style.display = enabled ? 'block' : 'none';
		aiButtons.forEach(btn => {
			if (btn) {
				const isAvailable = btn.getAttribute('data-ai-available') === 'true'; const shouldShow = enabled && isAvailable;
				btn.style.display = shouldShow ? 'flex' : 'none';
				if (btn.parentElement?.classList.contains('input-with-action')) btn.parentElement.style.display = shouldShow ? 'flex' : 'block';
			}
		});
	};
	ui.aiBackendSelect.onchange = () => { localStorage.setItem('ai-backend', ui.aiBackendSelect.value); updateBackendFields(ui); updateVisibility(ui.aiFeaturesToggle.checked); updateGlobalConfig(ui); };
	ui.aiUseAppCheckToggle.onchange = () => { localStorage.setItem('ai-use-app-check', ui.aiUseAppCheckToggle.checked); updateBackendFields(ui); updateGlobalConfig(ui); };
	aiKeys.forEach(id => {
		const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + (id.includes('toggle') ? '' : (id.includes('provider') || id.includes('backend') || id.includes('device') || id.includes('dtype') ? 'Select' : 'Input'));
		const input = ui[key] || document.getElementById(id);
		if (input && !input.onchange && !input.oninput) {
			const isCheckbox = input.type === 'checkbox';
			if (isCheckbox) input.checked = localStorage.getItem(id) === 'true';
			else input.value = localStorage.getItem(id) || (input.tagName === 'SELECT' ? input.options[0].value : '');
			input[isCheckbox ? 'onchange' : 'oninput'] = () => { localStorage.setItem(id, isCheckbox ? input.checked : input.value); updateGlobalConfig(ui); };
		}
	});
	updateBackendFields(ui); updateGlobalConfig(ui);
	const savedAiEnabled = localStorage.getItem('ai-features-enabled');
	const aiEnabled = savedAiEnabled === null ? true : savedAiEnabled === 'true';
	ui.aiFeaturesToggle.checked = aiEnabled;
	ui.aiOnlyExistingTagsToggle.checked = localStorage.getItem('ai-only-existing-tags') === 'true';
	aiButtons.forEach(btn => { if (btn && btn.style.display !== 'none') btn.setAttribute('data-ai-available', 'true'); });
	updateVisibility(aiEnabled);
	ui.aiFeaturesToggle.addEventListener('change', () => { localStorage.setItem('ai-features-enabled', ui.aiFeaturesToggle.checked); updateVisibility(ui.aiFeaturesToggle.checked); });
	ui.aiOnlyExistingTagsToggle.addEventListener('change', () => { localStorage.setItem('ai-only-existing-tags', ui.aiOnlyExistingTagsToggle.checked); });
	window.addEventListener('storage', (e) => {
		if (e.key === 'ai-features-enabled') { ui.aiFeaturesToggle.checked = e.newValue === 'true'; updateVisibility(ui.aiFeaturesToggle.checked); }
		else if (e.key === 'ai-only-existing-tags') { ui.aiOnlyExistingTagsToggle.checked = e.newValue === 'true'; }
		else if (aiKeys.includes(e.key)) { updateBackendFields(ui); updateGlobalConfig(ui); }
	});
}
