import { customAlert } from './dialog-utils.js';

export const aiKeys = [
	'ai-backend', 'ai-api-key', 'ai-model-name',
	'ai-project-id', 'ai-app-id', 'ai-gemini-api-provider',
	'ai-use-app-check', 'ai-recaptcha-site-key', 'ai-use-limited-use-tokens',
	'ai-device', 'ai-dtype'
];

const DEFAULT_CONFIGS = {
	'gemini-api': { 'ai-api-key': '', 'ai-model-name': '' },
	'openai': { 'ai-api-key': '', 'ai-model-name': '' },
	'firebase': { 
		'ai-api-key': '', 'ai-model-name': '', 'ai-project-id': '', 'ai-app-id': '', 
		'ai-gemini-api-provider': 'developer', 'ai-use-app-check': false, 
		'ai-recaptcha-site-key': '', 'ai-use-limited-use-tokens': false 
	},
	'transformers-js': { 'ai-model-name': '', 'ai-device': 'webgpu', 'ai-dtype': 'q4f16' }
};

export function getBackendConfigs() {
	return JSON.parse(localStorage.getItem('ai-backend-configs') || JSON.stringify(DEFAULT_CONFIGS));
}

export function saveBackendConfigs(configs) {
	localStorage.setItem('ai-backend-configs', JSON.stringify(configs));
}

export function checkAIKeys(ui) {
	const backend = ui.aiBackendSelect.value;
	if (backend === 'transformers-js') return true;
	
	const configs = getBackendConfigs();
	const apiKey = configs[backend]?.['ai-api-key'];
	
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

	const configs = getBackendConfigs();
	const current = configs[backend] || {};
	
	const apiKey = current['ai-api-key'] || (backend === 'transformers-js' ? 'dummy' : '');
	const modelName = current['ai-model-name'] || '';
	const config = { apiKey, modelName };

	if (backend === 'firebase') {
		window.FIREBASE_CONFIG = {
			...config, 
			projectId: current['ai-project-id'], 
			appId: current['ai-app-id'],
			geminiApiProvider: current['ai-gemini-api-provider'], 
			useAppCheck: current['ai-use-app-check'],
			reCaptchaSiteKey: current['ai-recaptcha-site-key'], 
			useLimitedUseAppCheckTokens: current['ai-use-limited-use-tokens']
		};
	} else if (backend === 'transformers-js') {
		window.TRANSFORMERS_CONFIG = { 
			...config, 
			device: current['ai-device'], 
			dtype: current['ai-dtype'] 
		};
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
