import { saveImage } from './db-storage.js';
import { saveDrafts } from './draft-manager.js';
import { wrapText } from './editor-logic.js';

export async function processImage(file, currentId, draft, ui) {
	const id = `${currentId}:${Date.now()}:${file.name}`;
	const buffer = await file.arrayBuffer();
	const dimensions = await new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve({ width: img.width, height: img.height });
		img.onerror = () => resolve({ width: '', height: '' });
		img.src = URL.createObjectURL(new Blob([buffer], { type: file.type }));
	});

	const isAiEnabled = localStorage.getItem('ai-features-enabled') === 'true';
	let aiMeta = null;
	if (isAiEnabled) {
		const { generateImageMetadata } = await import('./ai-multimodal.js');
		aiMeta = await generateImageMetadata(new Blob([buffer], { type: file.type }), ui);
	}
	const altText = aiMeta?.alt || "Alt text here";
	const caption = aiMeta?.caption || "Caption here";

	await saveImage(id, buffer);
	if (!draft.imageFiles) draft.imageFiles = [];
	draft.imageFiles.push({ name: file.name, id, type: file.type });
	saveDrafts();

	return {
		name: file.name,
		alt: altText,
		caption: caption,
		width: dimensions.width,
		height: dimensions.height
	};
}

export function getMarkdownForImage(imgInfo, needsNewlinesBefore = false, needsNewlinesAfter = false) {
	return `${needsNewlinesBefore ? '\n\n' : ''}<figure>
  <img
      src="./${imgInfo.name}"
      alt="${imgInfo.alt}"
      width="${imgInfo.width}" height="${imgInfo.height}" loading="lazy" decoding="async"
  >
  <figcaption>
    ${wrapText(imgInfo.caption, 80)}
  </figcaption>
</figure>${needsNewlinesAfter ? '\n\n' : '\n'}`;
}

export async function handleFiles(files, currentId, drafts, ui, updateCallback) {
	const draft = drafts.find(d => d.id === currentId);
	if (!draft || !files.length) return;

	ui.uploadBtn.disabled = true;
	const oldBtnText = ui.uploadBtn.textContent;
	ui.uploadBtn.textContent = '⏳ Processing...';
	ui.dropZone.setAttribute('data-disabled', 'true');

	try {
		for (const file of files) {
			const start = ui.contentInput.selectionStart, end = ui.contentInput.selectionEnd;
			const before = ui.contentInput.value.substring(0, start);
			const after = ui.contentInput.value.substring(end);
			const cleanBefore = before.replace(/\n+$/, '');
			const cleanAfter = after.replace(/^\n+/, '');

			const imgInfo = await processImage(file, currentId, draft, ui);
			const imgTag = getMarkdownForImage(imgInfo, cleanBefore.length > 0, cleanAfter.length > 0);

			ui.contentInput.value = cleanBefore + imgTag + cleanAfter;
		}
	} finally {
		ui.uploadBtn.disabled = false;
		ui.uploadBtn.textContent = oldBtnText;
		ui.dropZone.removeAttribute('data-disabled');
	}
	updateCallback();
}
