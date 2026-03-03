import { getImage } from './db-storage.js';

function formatPreviewDate(dateStr) {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function wrapText(text, limit) {
	const words = text.split(' ');
	let lines = [];
	let currentLine = '';
	words.forEach(word => {
		if ((currentLine + word).length > limit) {
			lines.push(currentLine.trim());
			currentLine = word + ' ';
		} else {
			currentLine += word + ' ';
		}
	});
	lines.push(currentLine.trim());
	return lines.join('\n    ');
}

const blobCache = new Map();

let domPurifyPromise = null;

async function sanitizeHTML(container, html) {
	const config = {
		// Allow blob: URLs for local images and relative paths
		ADD_ATTR: ['loading', 'decoding'],
		ADD_TAGS: ['figure', 'figcaption'],
		// Ensure src is allowed for blob and relative paths
		// See: https://github.com/cure53/dompurify/blob/main/demos/README.md#how-can-i-allow-blob-urls
		ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp|blob|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i
	};

	// Native Sanitizer API (Experimental)
	if ('setHTML' in container) {
		try {
			// Try to use native Sanitizer if it handles blob URLs
			container.setHTML(html);
			// Check if src was stripped (crude check)
			if (html.includes('src=') && !container.querySelector('[src]')) {
				throw new Error('Native Sanitizer stripped src');
			}
			return;
		} catch (e) {
			console.error(e);
		}
	}

	// Fallback to DOMPurify
	if (!window.DOMPurify && !domPurifyPromise) {
		const link = document.createElement('link');
		link.rel = 'modulepreload';
		link.href = '/js/purify.min.js';
		document.head.appendChild(link);

		domPurifyPromise = (async () => {
			try {
				await import('/js/purify.min.js');
				return window.DOMPurify;
			} catch (e) {
				return new Promise((resolve, reject) => {
					const script = document.createElement('script');
					script.src = '/js/purify.min.js';
					script.onload = () => resolve(window.DOMPurify);
					script.onerror = reject;
					document.head.appendChild(script);
				});
			}
		})();
	}

	const purify = window.DOMPurify || (await domPurifyPromise);
	if (purify && purify.sanitize) {
		container.innerHTML = purify.sanitize(html, config);
	} else {
		container.innerHTML = html;
	}
}

export async function updatePreview(currentId, drafts, ui) {
	const draft = drafts.find(d => d.id === currentId);
	if (!draft) return;
	let content = ui.contentInput.value;
	if (draft.imageFiles) {
		for (const img of draft.imageFiles) {
			let blobUrl = blobCache.get(img.id);
			if (!blobUrl) {
				const data = await getImage(img.id);
				if (data) {
					const type = img.type || (img.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg');
					blobUrl = URL.createObjectURL(new Blob([data], { type }));
					blobCache.set(img.id, blobUrl);
				}
			}
			if (blobUrl) content = content.replaceAll(`./${img.name}`, blobUrl);
		}
	}
	const tags = ui.getTags();
	const tagsHtml = tags.map(t => `<li><a href="#" class="post-tag">${t}</a></li>`).join('');
	const dateHtml = ui.dateInput.value ? `<time datetime="${ui.dateInput.value}">${formatPreviewDate(ui.dateInput.value)}</time>` : '';
	const title = ui.titleInput.value;
	const titleHtml = title ? `<h1>${title}</h1>` : '';
	const metadataHtml = (dateHtml || tagsHtml) ? `<ul class="post-metadata"><li>${dateHtml}</li>${tagsHtml}</ul>` : '';
	
	if (!title && !dateHtml && !tagsHtml && !content) {
		ui.previewContent.innerHTML = '';
	} else {
		await sanitizeHTML(ui.previewContent, `${titleHtml}${metadataHtml}${marked.parse(content)}`);
	}
	if (window.Prism) Prism.highlightAllUnder(ui.previewContent);
}
