import { ui } from './ui-elements.js';
import { drafts, createNewDraft, deleteDraft, updateDraftData } from './draft-manager.js';
import { updatePreview, handleFiles } from './editor-logic.js';
import { generateMarkdown, downloadZIP } from './zip-exporter.js';
import { initAI } from './ai-features.js';
import { initTagSuggestions } from './tag-suggestions.js';
import { initAIWriter } from './ai-writer.js';
import { initTagEditor } from './tag-editor.js';
import { initAIToggle } from './ai-toggle.js';
import { parseFrontmatter, populateUIFromMetadata } from './frontmatter-parser.js';

const tagEditor = initTagEditor(ui, () => sync());
const sync = () => {
	const id = localStorage.getItem('current-draft-id');
	updateDraftData(id, ui); updatePreview(id, drafts, ui); renderList();
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
	});
};
ui.downloadBtn.onclick = () => {
	const id = localStorage.getItem('current-draft-id'); const d = drafts.find(draft => draft.id === id);
	downloadZIP(d, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value);
};

ui.contentInput.onpaste = (e) => {
	const text = e.clipboardData.getData('text');
	const { metadata, content } = parseFrontmatter(text);
	if (metadata && Object.keys(metadata).length > 0) {
		e.preventDefault(); populateUIFromMetadata(metadata, ui, tagEditor);
		ui.contentInput.value = content; sync();
	}
};

[ui.dropZone, ui.contentInput].forEach(el => {
	el.ondragover = e => { e.preventDefault(); ui.dropZone.classList.add('dragover'); };
	el.ondragleave = () => ui.dropZone.classList.remove('dragover');
	el.ondrop = e => { e.preventDefault(); ui.dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files, localStorage.getItem('current-draft-id'), drafts, ui, sync); };
});

ui.uploadBtn.onclick = () => ui.fileInput.click();
ui.fileInput.onchange = () => handleFiles(ui.fileInput.files, localStorage.getItem('current-draft-id'), drafts, ui, sync);

(async () => {
	if (drafts.length === 0) createNewDraft(ui, loadDraft, renderList);
	else loadDraft(localStorage.getItem('current-draft-id') || drafts[0].id);

	await Promise.all([
		initAI(ui, sync),
		initTagSuggestions(ui, () => { tagEditor.renderPills(); sync(); }),
		initAIWriter(ui, sync)
	]);
	initAIToggle(ui);
})();
