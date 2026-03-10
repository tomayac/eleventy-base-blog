import { detectLanguage } from './ai-language-detection.js';
import { customAlert, customConfirm } from '../utils/dialog-utils.js';
import { getMonitor, runAIAction } from './ai-features.js';
import { updatePreview } from './ai-translator-ui.js';

/**
 * Supported locales for translation.
 * Filters out the default locale from window.DEFAULT_LOCALE.
 * @return {Array<string>} The supported locales.
 */
export const getSupportedLocales = () => {
  const locales = window.APP_LOCALES || ['en', 'es', 'ja'];
  const defaultLocale = window.DEFAULT_LOCALE || 'en';
  const defaultBase = defaultLocale.split('-')[0];
  return locales.filter((l) => {
    const base = l.split('-')[0];
    return base !== defaultBase;
  });
};

/**
 * Generates options for the AI Translator.
 * @param {Object} ui - The UI elements.
 * @param {string} sourceLanguage - The source language code.
 * @param {string} targetLanguage - The target language code.
 * @return {Object} The translator options.
 */
export const getTranslatorOptions = (ui, sourceLanguage, targetLanguage) => ({
  sourceLanguage,
  targetLanguage,
  ...getMonitor(ui, targetLanguage, `Translator (${targetLanguage})`),
});

/**
 * Runs the translation for a specific locale.
 * @param {Object} ui - The UI elements.
 * @param {string} targetLocale - The target locale.
 * @param {HTMLElement} details - The <details> element.
 * @param {Function} updateCallback - Callback for UI updates.
 */
export async function runTranslation(
  ui,
  targetLocale,
  details,
  updateCallback,
) {
  let sourceText = ui.contentInput.value;
  let isSelection = false;

  const selectionStart = ui.contentInput.selectionStart;
  const selectionEnd = ui.contentInput.selectionEnd;
  const selectedText = sourceText
    .substring(selectionStart, selectionEnd)
    .trim();

  if (selectedText) {
    sourceText = selectedText;
    isSelection = true;
  }

  if (!sourceText) {
    return customAlert(ui, 'Please write some content first.');
  }

  const textarea = details.querySelector('.translation-markdown');
  const preview = details.querySelector('.translation-preview');
  const btn = details.querySelector('.translate-btn');

  const isNative = Translator.toString().includes('[native code]');

  await runAIAction(
    ui,
    btn,
    async () => {
      const sourceLocale = await detectLanguage(sourceText);
      const options = getTranslatorOptions(ui, sourceLocale, targetLocale);
      const status = await Translator.availability(options);

      if (status === 'unavailable') {
        return customAlert(
          ui,
          `Translator unavailable from ${sourceLocale} to ${targetLocale}`,
        );
      }

      const translator = await Translator.create(options);

      // Split into paragraphs/blocks
      const blocks = sourceText.split(/\n\s*\n/);
      let translatedContent = '';

      if (isSelection) {
        // If selection, we'll try to figure out where to put it later.
      } else {
        textarea.value = '';
      }

      for (const block of blocks) {
        if (block.trim().startsWith('<figure')) {
          translatedContent +=
            (await translateFigure(translator, block)) + '\n\n';
        } else {
          const stream = translator.translateStreaming(block);
          let blockResult = '';
          for await (const chunk of stream) {
            blockResult += chunk;
          }
          translatedContent += blockResult + '\n\n';
        }

        if (!isSelection) {
          textarea.value = translatedContent.trim();
          await updatePreview(textarea, preview);
        }
      }

      if (isSelection) {
        let mode = 'append';
        if (textarea.value.trim()) {
          const choice = await customConfirm(
            ui,
            'You already have a translation. Should the AI replace it or append at the end?',
            { confirmText: 'Append', cancelText: 'Replace' },
          );
          if (choice === 'cancel') mode = 'replace';
          else if (choice !== 'confirm') return;
        }

        if (mode === 'replace') {
          textarea.value = translatedContent.trim();
        } else {
          textarea.value =
            textarea.value.replace(/\n+$/, '') +
            '\n\n' +
            translatedContent.trim();
        }
      }

      textarea.style.display = 'block';
      textarea.value = textarea.value.trim();
      await updatePreview(textarea, preview);
    },
    updateCallback,
    isNative,
  );
}

/**
 * Ensures all enabled locales have translations.
 * @param {Object} ui - The UI elements.
 * @param {Function} updateCallback - Callback for UI updates.
 * @return {Promise<void>}
 */
export async function ensureAllTranslationsReady(ui, updateCallback) {
  const enabledLocales = Array.from(
    ui.aiTranslationLocalesContainer.querySelectorAll(
      '.ai-locale-toggle:checked',
    ),
  ).map((cb) => cb.getAttribute('data-locale'));

  if (!ui.aiTranslateToggle.checked || enabledLocales.length === 0) {
    return;
  }

  const promises = enabledLocales.map(async (locale) => {
    const details = ui.aiTranslationsContainer.querySelector(
      `details[data-locale="${locale}"]`,
    );
    if (details) {
      const textarea = details.querySelector('.translation-markdown');
      if (textarea && !textarea.value.trim()) {
        await runTranslation(ui, locale, details, updateCallback);
      }
    }
  });

  await Promise.all(promises);
  updateCallback();
}

/**
 * Translates the alt attribute and figcaption of a <figure> tag.
 * @param {Object} translator - The translator instance.
 * @param {string} figureHtml - The original figure HTML.
 * @return {Promise<string>} The figure HTML with translated text.
 */
async function translateFigure(translator, figureHtml) {
  // Simple regex-based translation for alt and figcaption
  let result = figureHtml;

  // Translate alt
  const altMatch = result.match(/alt=["']([^"']*)["']/);
  if (altMatch && altMatch[1]) {
    const altText = altMatch[1];
    const translatedAlt = await translator.translate(altText);
    result = result
      .replace(`alt="${altText}"`, `alt="${translatedAlt}"`)
      .replace(`alt='${altText}'`, `alt='${translatedAlt}'`);
  }

  // Translate figcaption
  const figMatch = result.match(/<figcaption>([\s\S]*?)<\/figcaption>/);
  if (figMatch && figMatch[1]) {
    const figText = figMatch[1];
    const translatedFig = await translator.translate(figText);
    result = result.replace(
      `<figcaption>${figText}</figcaption>`,
      `<figcaption>${translatedFig}</figcaption>`,
    );
  }

  return result.trim();
}
