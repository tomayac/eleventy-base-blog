import { detectLanguage } from './ai-language-detection.js';

export const imageMetadataSchema = {
	"type": "object",
	"properties": {
		"alt": { "type": "string" },
		"caption": { "type": "string" }
	},
	"required": ["alt", "caption"],
	"additionalProperties": false
};

export async function generateImageMetadata(blob, ui) {
	const enabled = localStorage.getItem('ai-features-enabled') !== 'false';
	if (!enabled) return null;
	if (!('LanguageModel' in self)) await import('/js/prompt-api-polyfill.js');
	if (typeof LanguageModel === 'undefined') return null;

	try {
		const lang = await detectLanguage(ui.contentInput.value || 'English');
		const options = {
			expectedInputs: [
				{ type: 'text', languages: [lang] },
				{ type: 'image' }
			],
			expectedOutputs: [{ type: 'text', languages: [lang] }],
			initialPrompts: [{ 
				role: 'system', 
				content: `You are an expert at writing accessible alternative text and engaging captions for blog post images in ${lang}. Return a JSON object with "alt" and "caption" fields.` 
			}]
		};

		// Check availability with EXACT same options as per SKILL.md
		const status = await LanguageModel.availability(options);
		if (status === 'unavailable') return null;

		const session = await LanguageModel.create(options);
		
		// Prompt structure as per SKILL.md for multimodal content
		const response = await session.prompt([
			{
				role: 'user',
				content: [
					{ type: 'text', value: "Describe this image for a blog post. Focus on a concise alt text for accessibility and a creative caption." },
					{ type: 'image', value: blob }
				]
			}
		], { responseConstraint: imageMetadataSchema });

		return JSON.parse(response);
	} catch (e) {
		console.warn("Multimodal AI metadata generation failed", e);
		return null;
	}
}
