import { ui } from './ui-elements.js';
import { drafts, createNewDraft, deleteDraft, updateDraftData, performHousekeeping } from './draft-manager.js';
import { updatePreview, handleFiles, processImage, getMarkdownForImage } from './editor-logic.js';
import { generateMarkdown, downloadZIP } from './zip-exporter.js';
import { initAI } from './ai-features.js';
import { initTagSuggestions } from './ai-tag-suggestions.js';
import { initAIWriter } from './ai-writer.js';
import { initAIRewriter } from './ai-rewriter.js';
import { initTagEditor } from './tag-editor.js';
import { initAIToggle } from './ai-toggle.js';
import { parseFrontmatter, populateUIFromMetadata } from './frontmatter-parser.js';
import { customAlert } from './dialog-utils.js';
import { initGitHubSync, createPR } from './github-integration.js';
import { debounce } from './debounce.js';

const tagEditor = initTagEditor(ui, () => sync());
const debouncedPreview = debounce((id, ui) => {
	updatePreview(id, drafts, ui);
}, 300);

let lastSyncedTitle = '';
const sync = (e) => {
	const id = localStorage.getItem('current-draft-id');
	updateDraftData(id, ui);
	debouncedPreview(id, ui);
	if (ui.titleInput.value !== lastSyncedTitle) {
		renderList();
		lastSyncedTitle = ui.titleInput.value;
	}
};

function renderList() {
	ui.draftsListEl.innerHTML = '';
	const currentId = localStorage.getItem('current-draft-id');
	drafts.forEach(d => {
		const li = document.createElement('li'); if (d.id === currentId) li.classList.add('active');
		li.onclick = () => loadDraft(d.id);
		const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'current-draft'; radio.checked = d.id === currentId;
		const title = document.createElement('span'); title.className = 'draft-title'; title.textContent = d.title || 'Untitled Draft';
		const del = document.createElement('button'); del.className = 'delete-draft-btn'; del.textContent = '🗑️';
		del.onclick = (e) => { e.stopPropagation(); deleteDraft(d.id, ui, () => createNewDraft(ui, loadDraft, renderList), loadDraft, renderList); };
		li.append(radio, title, del); ui.draftsListEl.appendChild(li);
	});
}

function loadDraft(id) {
	const d = drafts.find(draft => draft.id === id); if (!d) return;
	localStorage.setItem('current-draft-id', id);
	ui.titleInput.value = d.title || ''; ui.descInput.value = d.description || '';
	ui.dateInput.value = d.date || ''; ui.tagsInput.value = d.tags || '';
	ui.contentInput.value = d.content || '';
	lastSyncedTitle = ui.titleInput.value;
	tagEditor.renderPills(); updatePreview(id, drafts, ui); renderList();
}

ui.titleInput.oninput = sync; ui.descInput.oninput = sync; ui.dateInput.oninput = sync; ui.contentInput.oninput = sync;

ui.newDraftBtn.onclick = () => createNewDraft(ui, loadDraft, renderList);
ui.copyBtn.onclick = () => {
	const id = localStorage.getItem('current-draft-id'); const d = drafts.find(draft => draft.id === id);
	const md = generateMarkdown(d, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value);
	navigator.clipboard.writeText(md).then(() => {
		const oldText = ui.copyBtn.textContent; ui.copyBtn.textContent = '✅ Copied!';
		setTimeout(() => ui.copyBtn.textContent = oldText, 2000);
	}).catch(() => customAlert(ui, 'Failed to copy to clipboard.'));
};
ui.downloadBtn.onclick = async () => {
	await performHousekeeping();
	const id = localStorage.getItem('current-draft-id'); const d = drafts.find(draft => draft.id === id);
	downloadZIP(d, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value);
};
ui.githubPrBtn.onclick = async () => {
	await performHousekeeping();
	const id = localStorage.getItem('current-draft-id'); const d = drafts.find(draft => draft.id === id);
	createPR(ui, d);
};

ui.contentInput.onpaste = async (e) => {
	if (e.clipboardData.files && e.clipboardData.files.length > 0) {
		e.preventDefault();
		handleFiles(e.clipboardData.files, localStorage.getItem('current-draft-id'), drafts, ui, sync);
		return;
	}
	
	const html = e.clipboardData.getData('text/html');
	if (html) {
		e.preventDefault();
		const id = localStorage.getItem('current-draft-id');
		const draft = drafts.find(d => d.id === id);
		
		const turndownService = new TurndownService({ headingStyle: 'atx', bullet: '*' });
		
		// Custom rule for images to use the project's <figure> markup
		turndownService.addRule('figureImages', {
			filter: 'img',
			replacement: function (content, node) {
				const src = node.getAttribute('src');
				const alt = node.getAttribute('alt') || '';
				if (src && src.startsWith('__PASTED_IMG_')) return src;
				return `<figure>\n  <img src="${src}" alt="${alt}" loading="lazy" decoding="async">\n  <figcaption>\n    ${alt}\n  </figcaption>\n</figure>`;
			}
		});

		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		const images = Array.from(doc.querySelectorAll('img'));
		const imageMap = new Map();
		
		images.forEach((img, i) => {
			const src = img.getAttribute('src');
			if (src) {
				const placeholder = `__PASTED_IMG_${i}__`;
				imageMap.set(placeholder, src);
				img.setAttribute('src', placeholder);
			}
		});

		let markdown = turndownService.turndown(doc.body.innerHTML);
		
		const start = ui.contentInput.selectionStart, end = ui.contentInput.selectionEnd;
		const val = ui.contentInput.value;
		const before = val.substring(0, start).replace(/\n+$/, '');
		const after = val.substring(end).replace(/^\n+/, '');
		
		let i = 0;
		for (const [placeholder, src] of imageMap) {
			try {
				const resp = await fetch(src);
				const blob = await resp.blob();
				let name = src.split('/').pop().split('?')[0] || `pasted-image.png`;
				if (name === 'image.png' || !name.includes('.')) name = `pasted-image-${Date.now()}-${i++}.png`;
				const file = new File([blob], name, { type: blob.type });
				const info = await processImage(file, id, draft, ui);
				const tag = getMarkdownForImage(info, false, false);
				markdown = markdown.replaceAll(placeholder, tag);
			} catch (err) {
				const fallbackTag = `<figure>\n  <img src="${src}" alt="" loading="lazy" decoding="async">\n  <figcaption>\n    Pasted Image\n  </figcaption>\n</figure>`;
				markdown = markdown.replaceAll(placeholder, fallbackTag);
			}
		}
		
		markdown = markdown.trim();
		ui.contentInput.value = before + (before.length > 0 ? '\n\n' : '') + markdown + (after.length > 0 ? '\n\n' : '') + after;
		sync();
		return;
	}

	const text = e.clipboardData.getData('text');
	const { metadata, content } = parseFrontmatter(text);
	if (metadata && Object.keys(metadata).length > 0) {
		e.preventDefault(); populateUIFromMetadata(metadata, ui, tagEditor);
		ui.contentInput.value = content; sync();
	}
};

let dragCounter = 0;
window.addEventListener('dragenter', e => {
	if (ui.dropZone.getAttribute('data-disabled') === 'true') return;
	if (e.dataTransfer.types.includes('Files')) {
		dragCounter++;
		ui.dropZone.classList.add('dragover');
	}
});
window.addEventListener('dragleave', () => {
	if (ui.dropZone.getAttribute('data-disabled') === 'true') return;
	dragCounter = Math.max(0, dragCounter - 1);
	if (dragCounter === 0) ui.dropZone.classList.remove('dragover');
});
window.addEventListener('dragover', e => {
	e.preventDefault();
});
window.addEventListener('drop', e => {
	if (ui.dropZone.getAttribute('data-disabled') === 'true') return;
	e.preventDefault();
	dragCounter = 0;
	ui.dropZone.classList.remove('dragover');
	if (e.dataTransfer.files && e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files, localStorage.getItem('current-draft-id'), drafts, ui, sync);
});

ui.uploadBtn.onclick = () => ui.fileInput.click();
ui.fileInput.onchange = () => handleFiles(ui.fileInput.files, localStorage.getItem('current-draft-id'), drafts, ui, sync);

(async () => {
	if (drafts.length === 0) createNewDraft(ui, loadDraft, renderList);
	else loadDraft(localStorage.getItem('current-draft-id') || drafts[0].id);
	initGitHubSync(ui);
	await Promise.all([
		initAI(ui, sync), initTagSuggestions(ui, () => { tagEditor.renderPills(); sync(); }),
		initAIWriter(ui, sync), initAIRewriter(ui, sync)
	]);
	initAIToggle(ui);
	await performHousekeeping();
})();
