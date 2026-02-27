import { ui } from './ui-elements.js';
import { drafts, createNewDraft, deleteDraft, updateDraftData, performHousekeeping, setCurrentDraftId } from './draft-manager.js';
import { updatePreview } from './editor-logic.js';
import { handleFiles } from './image-handler.js';
import { initPasteHandler } from './paste-handler.js';
import { generateMarkdown, downloadZIP } from './zip-exporter.js';
import { initAI } from './ai-features.js';
import { initTagSuggestions } from './ai-tag-suggestions.js';
import { initAIWriter } from './ai-writer.js';
import { initAIRewriter } from './ai-rewriter.js';
import { initTagEditor } from './tag-editor.js';
import { initAIToggle } from './ai-toggle.js';
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
	setCurrentDraftId(id);
	ui.titleInput.value = d.title || ''; ui.descInput.value = d.description || '';
	ui.dateInput.value = d.date || ''; ui.tagsInput.value = d.tags || '';
	ui.contentInput.value = d.content || '';
	ui.aiWriterInput.value = '';
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

initPasteHandler(ui, drafts, tagEditor, sync);

ui.uploadBtn.onclick = () => ui.fileInput.click();
ui.fileInput.onchange = () => handleFiles(ui.fileInput.files, localStorage.getItem('current-draft-id'), drafts, ui, sync);

(async () => {
	if (drafts.length === 0) createNewDraft(ui, loadDraft, renderList);
	else loadDraft(localStorage.getItem('current-draft-id') || drafts[0].id);
	initGitHubSync(ui);
	initAIToggle(ui);
	await Promise.all([
		initAI(ui, sync), initTagSuggestions(ui, () => { tagEditor.renderPills(); sync(); }),
		initAIWriter(ui, sync), initAIRewriter(ui, sync)
	]);
	await performHousekeeping();
})();
