import { customAlert } from './dialog-utils.js';

export const aiKeys = [
	'ai-backend', 'ai-api-key', 'ai-model-name',
	'ai-project-id', 'ai-app-id', 'ai-gemini-api-provider',
	'ai-use-app-check', 'ai-recaptcha-site-key', 'ai-use-limited-use-tokens',
	'ai-device', 'ai-dtype'
];

export function checkAIKeys(ui) {
	const backend = localStorage.getItem('ai-backend') || 'gemini-api';
	if (backend === 'transformers-js') return true;
	
	const apiKey = localStorage.getItem('ai-api-key');
	
	if (!apiKey) {
		ui.settingsDetails.open = true;
		customAlert(ui, 'Please enter your AI details in the Settings section to use AI features.');
		return false;
	}
	return true;
}

export function updateGlobalConfig(ui) {
	const backend = ui.aiBackendSelect.value;
	delete window.FIREBASE_CONFIG; delete window.TRANSFORMERS_CONFIG; delete window.OPENAI_CONFIG; delete window.GEMINI_CONFIG;

	const apiKey = backend === 'transformers-js' ? 'dummy' : ui.aiApiKeyInput.value;
	const modelName = backend === 'transformers-js' ? (ui.aiModelNameInput.value || 'gemma-3-1b-it-ONNX-GQA') : ui.aiModelNameInput.value;
	const config = { apiKey, modelName };

	if (backend === 'firebase') {
		window.FIREBASE_CONFIG = {
			...config, projectId: ui.aiProjectIdInput.value, appId: ui.aiAppIdInput.value,
			geminiApiProvider: ui.aiGeminiApiProviderSelect.value, useAppCheck: ui.aiUseAppCheckToggle.checked,
			reCaptchaSiteKey: ui.aiRecaptchaSiteKeyInput.value, useLimitedUseAppCheckTokens: ui.aiUseLimitedUseTokensToggle.checked
		};
	} else if (backend === 'transformers-js') {
		window.TRANSFORMERS_CONFIG = { ...config, device: ui.aiDeviceSelect.value, dtype: ui.aiDtypeSelect.value };
	} else if (backend === 'openai') { window.OPENAI_CONFIG = config; }
	else if (backend === 'gemini-api') { window.GEMINI_CONFIG = config; }
	localStorage.setItem('prompt-api-backend', backend);
}

export function updateBackendFields(ui) {
	const backend = ui.aiBackendSelect.value;
	document.querySelectorAll('.ai-backend-fields').forEach(el => {
		const supported = el.getAttribute('data-backend').split(' ');
		el.style.display = supported.includes(backend) ? 'block' : 'none';
	});
	if (ui.aiAppCheckFields) {
		ui.aiAppCheckFields.style.display = (backend === 'firebase' && ui.aiUseAppCheckToggle.checked) ? 'block' : 'none';
	}
}
