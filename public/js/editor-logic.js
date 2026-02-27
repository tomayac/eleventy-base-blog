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
		ui.previewContent.innerHTML = `${titleHtml}${metadataHtml}${marked.parse(content)}`;
	}
	if (window.Prism) Prism.highlightAllUnder(ui.previewContent);
}
