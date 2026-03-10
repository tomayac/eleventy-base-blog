import { detectLanguage } from './ai-language-detection.js';
import { customAlert, customConfirm } from '../utils/dialog-utils.js';
import { getMonitor, runAIAction } from './ai-features.js';
import { refreshAIVisibility } from './ai-toggle.js';
import { sanitizeHTML } from '../utils/sanitizer.js';
import { getImage } from '../utils/db-storage.js';
import { drafts, currentDraftId } from '../drafts/draft-manager.js';

/**
 * Cache for blob URLs to avoid redundant ObjectURL creations.
 */
const blobCache = new Map();

/**
 * Supported locales for translation.
 * Populated from window.APP_LOCALES (injected via Nunjucks).
 */
/**
 * Supported locales for translation.
 * Populated from window.APP_LOCALES (injected via Nunjucks).
 * Filters out the default locale from window.DEFAULT_LOCALE.
 */
const getSupportedLocales = () => {
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
const getTranslatorOptions = (ui, sourceLanguage, targetLanguage) => ({
  sourceLanguage,
  targetLanguage,
  ...getMonitor(ui, targetLanguage, `Translator (${targetLanguage})`),
});

/**
 * Initializes the AI Translator feature.
 * @param {Object} ui - The UI elements.
 * @param {Function} updateCallback - Callback for UI updates.
 * @return {Promise<void>}
 */
export async function initAITranslator(ui, updateCallback) {
  if (
    !('Translator' in self) ||
    (await self.Translator.availability({
      sourceLanguage: 'en',
      targetLanguage: 'es',
    }).catch(() => 'unavailable')) === 'unavailable'
  ) {
    await import('/js/task-apis/translator.js');
  }

  // Restore state
  ui.aiTranslateToggle.checked =
    localStorage.getItem('ai-translate-enabled') === 'true';
  ui.aiTranslationLocalesContainer.style.display = ui.aiTranslateToggle.checked
    ? 'block'
    : 'none';

  const savedLocales = JSON.parse(
    localStorage.getItem('ai-translate-locales') || '[]',
  );

  // Populate locale checkboxes dynamically
  ui.aiTranslationLocalesContainer.innerHTML = '';
  getSupportedLocales().forEach((locale) => {
    const label = document.createElement('label');
    label.className = 'ai-toggle-label';
    label.style.display = 'block';
    label.style.marginTop = '0.5rem';

    const displayName = new Intl.DisplayNames(['en'], { type: 'language' }).of(
      locale,
    );
    const checked = savedLocales.includes(locale) ? 'checked' : '';
    label.innerHTML = `
      ${displayName} (${locale})
      <input type="checkbox" switch data-locale="${locale}" class="ai-locale-toggle" ${checked}>
    `;
    ui.aiTranslationLocalesContainer.appendChild(label);
  });

  ui.aiTranslateToggle.onchange = () => {
    localStorage.setItem('ai-translate-enabled', ui.aiTranslateToggle.checked);
    ui.aiTranslationLocalesContainer.style.display = ui.aiTranslateToggle
      .checked
      ? 'block'
      : 'none';
    refreshAITranslationUI(ui, updateCallback);
  };

  ui.aiTranslationLocalesContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('ai-locale-toggle')) {
      const enabledLocales = Array.from(
        ui.aiTranslationLocalesContainer.querySelectorAll(
          '.ai-locale-toggle:checked',
        ),
      ).map((cb) => cb.getAttribute('data-locale'));
      localStorage.setItem(
        'ai-translate-locales',
        JSON.stringify(enabledLocales),
      );
      refreshAITranslationUI(ui, updateCallback);
    }
  });

  if (typeof Translator !== 'undefined') {
    ui.aiTranslationSection.setAttribute('data-ai-available', 'true');
    if (ui.aiTranslateAllBtn) {
      ui.aiTranslateAllBtn.setAttribute('data-ai-available', 'true');
      ui.aiTranslateAllBtn.onclick = () => {
        const enabledLocales = Array.from(
          ui.aiTranslationLocalesContainer.querySelectorAll(
            '.ai-locale-toggle:checked',
          ),
        ).map((cb) => cb.getAttribute('data-locale'));

        if (enabledLocales.length === 0) {
          customAlert(
            ui,
            'Please enable at least one locale translation in Settings.',
          );
          return;
        }

        enabledLocales.forEach((locale) => {
          const details = ui.aiTranslationsContainer.querySelector(
            `details[data-locale="${locale}"]`,
          );
          const btn = details?.querySelector('.translate-btn');
          if (btn) btn.click();
        });
      };
    }
    refreshAIVisibility(ui);
  }

  // Initial UI refresh based on restored state
  refreshAITranslationUI(ui, updateCallback);

  // Restore translations from the current draft if any
  const draft = drafts.find((d) => d.id === currentDraftId);
  if (draft && draft.translations) {
    restoreTranslations(ui, draft.translations, updateCallback);
  }

  // Global access for draft restoration
  window.restoreTranslations = (translations) =>
    restoreTranslations(ui, translations, updateCallback);
}

/**
 * Restores translations from draft data into the UI.
 * @param {Object} ui - The UI elements.
 * @param {Object} translations - The translations object from the draft.
 * @param {Function} updateCallback - Callback for UI updates.
 */
function restoreTranslations(ui, translations, updateCallback) {
  if (!ui.aiTranslateToggle.checked) return;

  if (!translations || Object.keys(translations).length === 0) {
    // Reset all translation toggles and clear containers
    ui.aiTranslationLocalesContainer
      .querySelectorAll('.ai-locale-toggle')
      .forEach((cb) => (cb.checked = false));
    localStorage.setItem('ai-translate-locales', JSON.stringify([]));
    refreshAITranslationUI(ui, updateCallback);
    return;
  }

  Object.entries(translations).forEach(([locale, data]) => {
    // Ensure the locale checkbox is checked
    const cb = ui.aiTranslationLocalesContainer.querySelector(
      `.ai-locale-toggle[data-locale="${locale}"]`,
    );
    if (cb && !cb.checked) {
      cb.checked = true;
    }
  });

  // Refresh UI to create details elements
  refreshAITranslationUI(ui, updateCallback);

  // Fill in the content
  Object.entries(translations).forEach(([locale, data]) => {
    const details = ui.aiTranslationsContainer.querySelector(
      `details[data-locale="${locale}"]`,
    );
    if (details) {
      const textarea = details.querySelector('.translation-markdown');
      const preview = details.querySelector('.translation-preview');
      if (textarea && data.content) {
        textarea.value = data.content;
        textarea.style.display = 'block';
        updatePreview(textarea, preview);
      }
    }
  });
}

/**
 * Refreshes the translation <details> elements based on enabled locales.
 * @param {Object} ui - The UI elements.
 * @param {Function} updateCallback - Callback for UI updates.
 */
function refreshAITranslationUI(ui, updateCallback) {
  const enabledLocales = Array.from(
    ui.aiTranslationLocalesContainer.querySelectorAll(
      '.ai-locale-toggle:checked',
    ),
  ).map((cb) => cb.getAttribute('data-locale'));

  if (!ui.aiTranslateToggle.checked) {
    ui.aiTranslationSection.style.display = 'none';
    ui.aiTranslationsContainer.innerHTML = '';
    return;
  }

  ui.aiTranslationSection.style.display =
    enabledLocales.length > 0 ? 'block' : 'none';

  // Remove details for locales that were unchecked
  Array.from(ui.aiTranslationsContainer.querySelectorAll('details')).forEach(
    (details) => {
      const locale = details.getAttribute('data-locale');
      if (!enabledLocales.includes(locale)) {
        details.remove();
      }
    },
  );

  // Add details for new locales
  enabledLocales.forEach((locale) => {
    if (
      !ui.aiTranslationsContainer.querySelector(
        `details[data-locale="${locale}"]`,
      )
    ) {
      createTranslationDetails(ui, locale, updateCallback);
    }
  });
}

/**
 * Creates a <details> element for a specific locale translation.
 * @param {Object} ui - The UI elements.
 * @param {string} locale - The locale code.
 * @param {Function} updateCallback - Callback for UI updates.
 */
function createTranslationDetails(ui, locale, updateCallback) {
  const details = document.createElement('details');
  details.setAttribute('data-locale', locale);
  details.className = 'translation-details';
  details.style.marginBottom = '1rem';
  details.style.border = '1px solid var(--border-color)';
  details.style.borderRadius = '4px';
  details.style.padding = '0.5rem';

  const displayName = new Intl.DisplayNames(['en'], { type: 'language' }).of(
    locale,
  );

  details.innerHTML = `
    <summary style="cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: space-between;">
      <span>${displayName}</span>
      <button type="button" class="btn ai-button translate-btn" data-ai-available="true" title="Translate whole post" style="font-size: 0.8rem; padding: 2px 8px;">✨</button>
    </summary>
    <div class="translation-content-wrapper" style="margin-top: 0.5rem;">
      <textarea class="translation-markdown" style="width: 100%; height: 200px; display: none; margin-bottom: 0.5rem;" placeholder="Translated Markdown..."></textarea>
      <div class="translation-preview markdown-body" style="padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px; min-height: 50px;"></div>
    </div>
  `;

  ui.aiTranslationsContainer.appendChild(details);

  const translateBtn = details.querySelector('.translate-btn');
  const textarea = details.querySelector('.translation-markdown');
  const preview = details.querySelector('.translation-preview');

  details.ontoggle = () => {
    if (details.open && !textarea.value) {
      runTranslation(ui, locale, details, updateCallback);
    }
  };

  translateBtn.onclick = (e) => {
    e.stopPropagation();
    runTranslation(ui, locale, details, updateCallback);
  };

  textarea.onkeyup = () => {
    updatePreview(textarea, preview);
    updateCallback();
  };
}

/**
 * Updates the HTML preview for a translation.
 * @param {HTMLTextAreaElement} textarea - The markdown source.
 * @param {HTMLElement} preview - The preview container.
 */
async function updatePreview(textarea, preview) {
  let content = textarea.value;
  const draft = drafts.find((d) => d.id === currentDraftId);
  if (draft && draft.imageFiles) {
    for (const img of draft.imageFiles) {
      let blobUrl = blobCache.get(img.id);
      if (!blobUrl) {
        const data = await getImage(img.id);
        if (data) {
          const type =
            img.type ||
            (img.name.toLowerCase().endsWith('.svg')
              ? 'image/svg+xml'
              : 'image/jpeg');
          blobUrl = URL.createObjectURL(new Blob([data], { type }));
          blobCache.set(img.id, blobUrl);
        }
      }
      if (blobUrl) {
        content = content.replaceAll(`./${img.name}`, blobUrl);
      }
    }
  }
  await sanitizeHTML(preview, marked.parse(content));
}

/**
 * Runs the translation for a specific locale.
 * @param {Object} ui - The UI elements.
 * @param {string} targetLocale - The target locale.
 * @param {HTMLElement} details - The <details> element.
 * @param {Function} updateCallback - Callback for UI updates.
 */
async function runTranslation(ui, targetLocale, details, updateCallback) {
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
        // For now, let's just translate it.
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

  // Ensure two newlines before and after (handled by caller adding \n\n)
  return result.trim();
}
