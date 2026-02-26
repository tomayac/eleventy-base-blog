import { saveImage, getImage } from './db-storage.js';
import { generateImageMetadata } from './ai-multimodal.js';
import { saveDrafts } from './draft-manager.js';

function formatPreviewDate(dateStr) {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function wrapText(text, limit) {
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
	ui.previewContent.innerHTML = `<h1>${ui.titleInput.value || 'Untitled'}</h1><ul class="post-metadata"><li>${dateHtml}</li>${tagsHtml}</ul>${marked.parse(content)}`;
	if (window.Prism) Prism.highlightAllUnder(ui.previewContent);
}

export async function handleFiles(files, currentId, drafts, ui, updateCallback) {
	const draft = drafts.find(d => d.id === currentId);
	if (!draft || !files.length) return;
	if (!draft.imageFiles) draft.imageFiles = [];

	ui.uploadBtn.disabled = true;
	const oldBtnText = ui.uploadBtn.textContent;
	ui.uploadBtn.textContent = '⏳ Processing...';
	ui.dropZone.setAttribute('data-disabled', 'true');

	try {
		for (const file of files) {
			const id = `${currentId}:${Date.now()}:${file.name}`;
			const buffer = await file.arrayBuffer();
			const dimensions = await new Promise((resolve) => {
				const img = new Image();
				img.onload = () => resolve({ width: img.width, height: img.height });
				img.onerror = () => resolve({ width: '', height: '' });
				img.src = URL.createObjectURL(new Blob([buffer], { type: file.type }));
			});

			const aiMeta = await generateImageMetadata(new Blob([buffer], { type: file.type }), ui);
			const altText = aiMeta?.alt || "Alt text here";
			const caption = aiMeta?.caption || "Caption here";

			await saveImage(id, buffer);
			draft.imageFiles.push({ name: file.name, id, type: file.type });
			saveDrafts();
			
			const start = ui.contentInput.selectionStart, end = ui.contentInput.selectionEnd;
			const before = ui.contentInput.value.substring(0, start);
			const after = ui.contentInput.value.substring(end);
			const cleanBefore = before.replace(/\n+$/, '');
			const cleanAfter = after.replace(/^\n+/, '');
			
			const needsNewlinesBefore = cleanBefore.length > 0;
			const needsNewlinesAfter = cleanAfter.length > 0;
			
			const imgTag = `${needsNewlinesBefore ? '\n\n' : ''}<figure>
  <img
      src="./${file.name}"
      alt="${altText}"
      width="${dimensions.width}" height="${dimensions.height}" loading="lazy" decoding="async"
  >
  <figcaption>
    ${wrapText(caption, 80)}
  </figcaption>
</figure>${needsNewlinesAfter ? '\n\n' : '\n'}`;
			
			ui.contentInput.value = cleanBefore + imgTag + cleanAfter;
		}
	} finally {
		ui.uploadBtn.disabled = false;
		ui.uploadBtn.textContent = oldBtnText;
		ui.dropZone.removeAttribute('data-disabled');
	}
	updateCallback();
}
