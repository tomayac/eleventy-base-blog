import { drafts, currentDraftId, createNewDraft, deleteDraft, updateDraftData } from './draft-manager.js';
import { updatePreview, handleFiles } from './editor-logic.js';
import { generateMarkdown, downloadZIP } from './zip-exporter.js';
import { initAI } from './ai-features.js';
import { initTagSuggestions } from './tag-suggestions.js';

const ui = {
	draftsListEl: document.getElementById('drafts-list'),
	newDraftBtn: document.getElementById('new-draft-btn'),
	titleInput: document.getElementById('post-title'),
	descInput: document.getElementById('post-description'),
	dateInput: document.getElementById('post-date'),
	tagsInput: document.getElementById('post-tags'),
	aiSuggestTagsBtn: document.getElementById('ai-suggest-tags-btn'),
	contentInput: document.getElementById('post-content'),
	previewContent: document.getElementById('preview-content'),
	copyBtn: document.getElementById('copy-btn'),
	downloadBtn: document.getElementById('download-btn'),
	dropZone: document.getElementById('drop-zone'),
	fileInput: document.getElementById('file-input'),
	uploadBtn: document.getElementById('upload-btn'),
	aiSuggestTitleBtn: document.getElementById('ai-suggest-title-btn'),
	aiStatus: document.getElementById('ai-status'),
	aiDownloadProgress: document.getElementById('ai-download-progress'),
	aiStatusText: document.getElementById('ai-status-text')
};

function renderList() {
	ui.draftsListEl.innerHTML = '';
	drafts.forEach(d => {
		const li = document.createElement('li');
		if (d.id === currentDraftId) li.classList.add('active');
		li.onclick = () => loadDraft(d.id);
		const radio = document.createElement('input');
		radio.type = 'radio'; radio.name = 'current-draft'; radio.checked = d.id === currentDraftId;
		const title = document.createElement('span');
		title.className = 'draft-title'; title.textContent = d.title || 'Untitled Draft';
		const del = document.createElement('button');
		del.className = 'delete-draft-btn'; del.innerHTML = '🗑️';
		del.onclick = (e) => { e.stopPropagation(); deleteDraft(d.id, ui, () => createNewDraft(ui, loadDraft, renderList), loadDraft, renderList); };
		li.append(radio, title, del); ui.draftsListEl.appendChild(li);
	});
}

function loadDraft(id) {
	const d = drafts.find(draft => draft.id === id);
	if (!d) return;
	localStorage.setItem('current-draft-id', id);
	ui.titleInput.value = d.title || ''; ui.descInput.value = d.description || '';
	ui.dateInput.value = d.date || ''; ui.tagsInput.value = d.tags || '';
	ui.contentInput.value = d.content || '';
	updatePreview(id, drafts, ui); renderList();
}

const sync = () => { updateDraftData(currentDraftId, ui); updatePreview(currentDraftId, drafts, ui); renderList(); };
ui.titleInput.oninput = sync; ui.descInput.oninput = sync; ui.dateInput.oninput = sync;
ui.tagsInput.oninput = sync; ui.contentInput.oninput = sync;
ui.newDraftBtn.onclick = () => createNewDraft(ui, loadDraft, renderList);
ui.copyBtn.onclick = () => {
	const d = drafts.find(draft => draft.id === currentDraftId);
	const md = generateMarkdown(d, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value);
	navigator.clipboard.writeText(md).then(() => alert('Markdown copied!'));
};
ui.downloadBtn.onclick = () => {
	const d = drafts.find(draft => draft.id === currentDraftId);
	downloadZIP(d, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value);
};

[ui.dropZone, ui.contentInput].forEach(el => {
	el.ondragover = e => { e.preventDefault(); ui.dropZone.classList.add('dragover'); };
	el.ondragleave = () => ui.dropZone.classList.remove('dragover');
	el.ondrop = e => { e.preventDefault(); ui.dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files, currentDraftId, drafts, ui, sync); };
});

ui.uploadBtn.onclick = () => ui.fileInput.click();
ui.fileInput.onchange = () => handleFiles(ui.fileInput.files, currentDraftId, drafts, ui, sync);

if (drafts.length === 0) createNewDraft(ui, loadDraft, renderList);
else loadDraft(currentDraftId || drafts[0].id);

initAI(ui, sync);
initTagSuggestions(ui, sync);
