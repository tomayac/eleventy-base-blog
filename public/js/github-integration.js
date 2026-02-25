import { getImage } from './db-storage.js';
import { generateMarkdown } from './zip-exporter.js';
import { customAlert } from './dialog-utils.js';

export function initGitHubSync(ui) {
	['gh-token', 'gh-owner', 'gh-repo'].forEach(id => {
		const input = ui[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'Input'];
		input.value = localStorage.getItem(id) || '';
		input.oninput = () => localStorage.setItem(id, input.value);
	});
}

function toBase64(str) {
	return btoa(unescape(encodeURIComponent(str)));
}

async function ghFetch(ui, path, options = {}) {
	const token = ui.ghTokenInput.value;
	const owner = ui.ghOwnerInput.value;
	const repo = ui.ghRepoInput.value;
	const url = `https://api.github.com/repos/${owner}/${repo}${path}`;
	const response = await fetch(url, {
		...options,
		headers: {
			'Authorization': `token ${token}`,
			'Accept': 'application/vnd.github.v3+json',
			...options.headers
		}
	});
	if (!response.ok) throw new Error(await response.text());
	return response.json();
}

export async function createPR(ui, draft) {
	const owner = ui.ghOwnerInput.value;
	const repo = ui.ghRepoInput.value;
	const token = ui.ghTokenInput.value;
	if (!owner || !repo || !token) return customAlert(ui, 'Please fill in GitHub settings first.');

	ui.githubPrBtn.disabled = true; ui.githubPrBtn.textContent = '⏳ Creating...';
	try {
		const slug = (ui.titleInput.value || 'untitled').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
		const branchName = `post-${slug}-${Date.now()}`;
		const md = generateMarkdown(draft, ui.titleInput.value, ui.descInput.value, ui.dateInput.value, ui.tagsInput.value, ui.contentInput.value);

		const main = await ghFetch(ui, '/branches/main');
		const baseSha = main.commit.sha;

		await ghFetch(ui, '/git/refs', {
			method: 'POST',
			body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
		});

		for (const img of (draft.imageFiles || [])) {
			const data = await getImage(img.id);
			if (data) {
				const content = btoa(String.fromCharCode(...new Uint8Array(data)));
				await ghFetch(ui, `/contents/content/blog/${slug}/${img.name}`, {
					method: 'PUT',
					body: JSON.stringify({ message: `Add image ${img.name}`, content, branch: branchName })
				});
			}
		}

		await ghFetch(ui, `/contents/content/blog/${slug}/${slug}.md`, {
			method: 'PUT',
			body: JSON.stringify({ message: `Add post ${slug}`, content: toBase64(md), branch: branchName })
		});

		const pr = await ghFetch(ui, '/pulls', {
			method: 'POST',
			body: JSON.stringify({ title: `Post: ${ui.titleInput.value}`, head: branchName, base: 'main' })
		});

		customAlert(ui, `PR created successfully! Link: ${pr.html_url}`);
		window.open(pr.html_url, '_blank');
	} catch (e) {
		console.error(e); customAlert(ui, `Failed to create PR: ${e.message}`);
	} finally {
		ui.githubPrBtn.disabled = false; ui.githubPrBtn.textContent = '🚀 Create PR';
	}
}
