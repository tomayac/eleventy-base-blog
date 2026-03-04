import { getImage } from "../utils/db-storage.js";
import { generateMarkdown } from "../export/zip-exporter.js";
import { customAlert } from "../utils/dialog-utils.js";
import { toBase64, bufferToBase64 } from "../utils/base64-utils.js";
import { ghFetch } from "./github-api.js";

export async function createPR(ui, draft) {
  const { ghOwnerInput: owner, ghRepoInput: repo, ghTokenInput: token } = ui;
  if (!owner.value || !repo.value || !token.value) {
    customAlert(ui, "Please fill in GitHub settings first.");
    ui.settingsDetails.open = true;
    if (!token.value) token.focus();
    else if (!owner.value) owner.focus();
    else if (!repo.value) repo.focus();
    return;
  }
  ui.githubPrBtn.disabled = true;
  ui.githubPrBtn.textContent = "⏳ Creating...";
  try {
    const slug = ui.getSlug(ui.titleInput.value);
    const branchName = `post-${slug}-${Date.now()}`;
    const classifierResults = window.getSelectedClassifierResults
      ? window.getSelectedClassifierResults()
      : [];
    const md = generateMarkdown(
      draft,
      ui.titleInput.value,
      ui.descInput.value,
      ui.dateInput.value,
      ui.tagsInput.value,
      ui.contentInput.value,
      classifierResults,
    );

    const repoInfo = await ghFetch(ui, "");
    const defaultBranch = repoInfo.default_branch;
    const branchInfo = await ghFetch(ui, `/branches/${defaultBranch}`);
    const baseSha = branchInfo.commit.sha;

    await ghFetch(ui, "/git/refs", {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
    });

    for (const img of draft.imageFiles || []) {
      const data = await getImage(img.id);
      if (data) {
        const content = await bufferToBase64(data);
        const imgPath = img.path || `content/blog/${slug}/${img.name}`;
        await ghFetch(ui, `/contents/${imgPath}`, {
          method: "PUT",
          body: JSON.stringify({
            message: `${img.sha ? "Update" : "Add"} image ${img.name}`,
            content,
            branch: branchName,
            sha: img.sha,
          }),
        });
      }
    }

    await ghFetch(
      ui,
      `/contents/${draft.path || `content/blog/${slug}/${slug}.md`}`,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `${draft.sha ? "Update" : "Add"} post ${slug}`,
          content: toBase64(md),
          branch: branchName,
          sha: draft.sha,
        }),
      },
    );

    const pr = await ghFetch(ui, "/pulls", {
      method: "POST",
      body: JSON.stringify({
        title: `${draft.sha ? "Update" : "Post"}: ${ui.titleInput.value}`,
        head: branchName,
        base: defaultBranch,
      }),
    });
    customAlert(ui, `PR created successfully!`);
    window.open(pr.html_url, "_blank");
  } catch (e) {
    console.error(e);
    customAlert(ui, `Failed to create PR: ${e.message}`);
  } finally {
    ui.githubPrBtn.disabled = false;
    ui.githubPrBtn.textContent = "🚀 Create PR";
  }
}
