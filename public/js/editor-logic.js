import { saveImage, getImage } from './db-storage.js';

function formatPreviewDate(dateStr) {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

export async function updatePreview(currentId, drafts, ui) {
	const draft = drafts.find(d => d.id === currentId);
	if (!draft) return;
	let content = ui.contentInput.value;
	if (draft.imageFiles) {
		for (const img of draft.imageFiles) {
			const data = await getImage(img.id);
			if (data) content = content.replaceAll(`./${img.name}`, URL.createObjectURL(new Blob([data])));
		}
	}

	const tags = ui.tagsInput.value.split(',').map(t => t.trim()).filter(t => t && t !== 'posts');
	const tagsHtml = tags.map(t => `<li><a href="#" class="post-tag">${t}</a></li>`).join('');
	const dateHtml = ui.dateInput.value ? `<time datetime="${ui.dateInput.value}">${formatPreviewDate(ui.dateInput.value)}</time>` : '';

	ui.previewContent.innerHTML = `<h1>${ui.titleInput.value || 'Untitled'}</h1><ul class="post-metadata"><li>${dateHtml}</li>${tagsHtml}</ul>${marked.parse(content)}`;
	
	// Syntax highlight code blocks in the preview
	if (window.Prism) {
		// Use highlightAllUnder which is standard for Prism to find and highlight <code> blocks
		Prism.highlightAllUnder(ui.previewContent);
	}
}

export async function handleFiles(files, currentId, drafts, ui, updateCallback) {
	const draft = drafts.find(d => d.id === currentId);
	if (!draft || !files.length) return;
	if (!draft.imageFiles) draft.imageFiles = [];

	for (const file of files) {
		const id = `${currentId}:${Date.now()}:${file.name}`;
		const buffer = await file.arrayBuffer();
		const dimensions = await new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve({ width: img.width, height: img.height });
			img.onerror = () => resolve({ width: '', height: '' });
			img.src = URL.createObjectURL(new Blob([buffer]));
		});
		await saveImage(id, buffer);
		draft.imageFiles.push({ name: file.name, id });
		const imgTag = `\n<figure>\n\t<img src="./${file.name}" alt="Alt text" width="${dimensions.width}" height="${dimensions.height}" loading="lazy" decoding="async">\n\t<figcaption>Caption</figcaption>\n</figure>\n`;
		const start = ui.contentInput.selectionStart, end = ui.contentInput.selectionEnd;
		ui.contentInput.value = ui.contentInput.value.substring(0, start) + imgTag + ui.contentInput.value.substring(end);
	}
	updateCallback();
}
