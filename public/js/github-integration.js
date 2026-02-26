import { getImage } from './db-storage.js';
import { generateMarkdown } from './zip-exporter.js';
import { customAlert } from './dialog-utils.js';
import { toBase64, bufferToBase64 } from './base64-utils.js';

export function initGitHubSync(ui) {
	['gh-token', 'gh-owner', 'gh-repo'].forEach(id => {
		const input = ui[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Input'];
		let value = localStorage.getItem(id) || (id === 'gh-token' ? window.FIREBASE_CONFIG?.github_pat : '');
		if (input) { input.value = value || ''; input.oninput = () => localStorage.setItem(id, input.value); }
	});
}

async function ghFetch(ui, path, options = {}) {
	const url = path.startsWith('https://') ? path : `https://api.github.com/repos/${ui.ghOwnerInput.value}/${ui.ghRepoInput.value}${path}`;
	const res = await fetch(url, { ...options, headers: { 'Authorization': `token ${ui.ghTokenInput.value}`, 'Accept': 'application/vnd.github.v3+json', ...options.headers } });
	if (!res.ok) {
		const txt = await res.text(); let err; try { err = JSON.parse(txt); } catch(e) { err = { message: txt }; }
		throw new Error(err.message || res.statusText);
	}
	return res.json();
}

export async function createPR(ui, draft) {
	const { ghOwnerInput: owner, ghRepoInput: repo, ghTokenInput: token } = ui;
	if (!owner.value || !repo.value || !token.value) return customAlert(ui, 'Please fill in GitHub settings first.');
	ui.githubPrBtn.disabled = true; ui.githubPrBtn.textContent = '⏳ Creating...';
	try {
		const slug = ui.getSlug(ui.titleInput.value);
		const branchName = `post-${slug}-${Date.now()}`;
		const md = generateMarkdown(draft, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value);

		const repoInfo = await ghFetch(ui, '');
		const defaultBranch = repoInfo.default_branch;
		const branchInfo = await ghFetch(ui, `/branches/${defaultBranch}`);
		const baseSha = branchInfo.commit.sha;

		await ghFetch(ui, '/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }) });

		for (const img of (draft.imageFiles || [])) {
			const data = await getImage(img.id);
			if (data) {
				const content = await bufferToBase64(data);
				await ghFetch(ui, `/contents/content/blog/${slug}/${img.name}`, { method: 'PUT', body: JSON.stringify({ message: `Add image ${img.name}`, content, branch: branchName }) });
			}
		}

		await ghFetch(ui, `/contents/content/blog/${slug}/${slug}.md`, { method: 'PUT', body: JSON.stringify({ message: `Add post ${slug}`, content: toBase64(md), branch: branchName }) });

		const pr = await ghFetch(ui, '/pulls', { method: 'POST', body: JSON.stringify({ title: `Post: ${ui.titleInput.value}`, head: branchName, base: defaultBranch }) });
		customAlert(ui, `PR created successfully!`); window.open(pr.html_url, '_blank');
	} catch (e) { console.error(e); customAlert(ui, `Failed to create PR: ${e.message}`); }
	finally { ui.githubPrBtn.disabled = false; ui.githubPrBtn.textContent = '🚀 Create PR'; }
}
