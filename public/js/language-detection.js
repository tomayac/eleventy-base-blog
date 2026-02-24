export async function detectLanguage(text) {
	if (!('LanguageDetector' in self)) {
		await import('/js/task-apis/language-detector.js');
	}

	if (typeof LanguageDetector === 'undefined') return 'en';

	try {
		const capabilities = await LanguageDetector.availability();
		if (capabilities === 'unavailable') return 'en';

		const detector = await LanguageDetector.create();
		const results = await detector.detect(text);
		
		// Return the most confident result's language, or default to English
		return results.length > 0 ? results[0].detectedLanguage : 'en';
	} catch (e) {
		console.warn("Language detection failed", e);
		return 'en';
	}
}
