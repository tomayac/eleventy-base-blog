import { sanitizeHTML } from '../utils/sanitizer.js';
import { getImage } from '../utils/db-storage.js';
import { drafts, currentDraftId } from '../drafts/draft-manager.js';
import { runTranslation } from './ai-translator-core.js';

/**
 * Cache for blob URLs to avoid redundant ObjectURL creations.
 */
const blobCache = new Map();

/**
 * Restores translations from draft data into the UI.
 * @param {Object} ui - The UI elements.
 * @param {Object} translations - The translations object from the draft.
 * @param {Function} updateCallback - Callback for UI updates.
 */
export function restoreTranslations(ui, translations, updateCallback) {
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
export function refreshAITranslationUI(ui, updateCallback) {
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
export function createTranslationDetails(ui, locale, updateCallback) {
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
export async function updatePreview(textarea, preview) {
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
