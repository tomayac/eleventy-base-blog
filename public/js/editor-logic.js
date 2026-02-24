import { saveImage, getImage } from './db-storage.js';

export async function updatePreview(currentDraftId, drafts, ui) {
	const draft = drafts.find(d => d.id === currentDraftId);
	let content = ui.contentInput.value;
	if (draft && draft.imageFiles) {
		for (const img of draft.imageFiles) {
			const data = await getImage(img.id);
			if (data) {
				const blob = new Blob([data]);
				content = content.replaceAll(`./${img.name}`, URL.createObjectURL(blob));
			}
		}
	}
	ui.previewContent.innerHTML = marked.parse(content);
}

export async function handleFiles(files, currentDraftId, drafts, ui, updateCallback) {
	const draft = drafts.find(d => d.id === currentDraftId);
	if (!draft) return;
	if (!draft.imageFiles) draft.imageFiles = [];

	for (const file of files) {
		const id = `${currentDraftId}:${Date.now()}:${file.name}`;
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
