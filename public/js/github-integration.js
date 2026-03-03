import { getImage } from "./db-storage.js";
import { generateMarkdown } from "./zip-exporter.js";
import { customAlert } from "./dialog-utils.js";
import { fromBase64, toBase64, bufferToBase64 } from "./base64-utils.js";

const GH_CONFIG_KEY = "gh-config";

export function initGitHubSync(ui) {
  const config = JSON.parse(localStorage.getItem(GH_CONFIG_KEY) || "{}");

  ["gh-token", "gh-owner", "gh-repo"].forEach((id) => {
    const key = id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + "Input";
    const input = ui[key];
    if (!input) return;

    // Migration / Initial load
    let value = config[id] || localStorage.getItem(id);
    if (!value && id === "gh-token") value = window.FIREBASE_CONFIG?.github_pat;

    input.value = value || "";

    input.oninput = () => {
      const currentConfig = JSON.parse(
        localStorage.getItem(GH_CONFIG_KEY) || "{}",
      );
      currentConfig[id] = input.value;
      localStorage.setItem(GH_CONFIG_KEY, JSON.stringify(currentConfig));
    };
  });
}

async function ghFetch(ui, path, options = {}) {
  const url = path.startsWith("https://")
    ? path
    : `https://api.github.com/repos/${ui.ghOwnerInput.value}/${ui.ghRepoInput.value}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${ui.ghTokenInput.value}`,
      Accept: "application/vnd.github.v3+json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    let err;
    try {
      err = JSON.parse(txt);
    } catch (e) {
      err = { message: txt };
    }
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function createPR(ui, draft) {
  const { ghOwnerInput: owner, ghRepoInput: repo, ghTokenInput: token } = ui;
  if (!owner.value || !repo.value || !token.value)
    return customAlert(ui, "Please fill in GitHub settings first.");
  ui.githubPrBtn.disabled = true;
  ui.githubPrBtn.textContent = "⏳ Creating...";
  try {
    const slug = ui.getSlug(ui.titleInput.value);
    const branchName = `post-${slug}-${Date.now()}`;
    const classifierIds = window.getSelectedClassifierIds
      ? window.getSelectedClassifierIds()
      : [];
    const md = generateMarkdown(
      draft,
      ui.titleInput.value,
      ui.descInput.value,
      ui.dateInput.value,
      ui.tagsInput.value,
      ui.contentInput.value,
      classifierIds,
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

export async function loadPostFromGitHub(ui, path) {
  const { ghOwnerInput: owner, ghRepoInput: repo, ghTokenInput: token } = ui;
  if (!owner.value || !repo.value || !token.value)
    throw new Error("Please fill in GitHub settings first.");

  const cleanPath = path.startsWith("./") ? path.substring(2) : path;
  try {
    const file = await ghFetch(ui, `/contents/${cleanPath}`);
    const content = fromBase64(file.content);
    const sha = file.sha;

    // Simple front matter parser
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { content, sha, path: cleanPath };

    const frontMatter = match[1];
    const body = match[2];
    const data = {};
    frontMatter.split("\n").forEach((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex === -1) return;
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      if (value.startsWith('"') && value.endsWith('"'))
        value = value.substring(1, value.length - 1);
      if (value.startsWith("[") && value.endsWith("]"))
        value = value
          .substring(1, value.length - 1)
          .split(",")
          .map((t) => t.trim().replace(/^["']|["']$/g, ""));
      data[key] = value;
    });

    // Fetch images if in the same directory
    const dirPath = cleanPath.substring(0, cleanPath.lastIndexOf("/"));
    let images = [];
    try {
      const dirContents = await ghFetch(ui, `/contents/${dirPath}`);
      const imageFiles = dirContents.filter(
        (f) => f.type === "file" && /\.(jpe?g|png|gif|webp|svg)$/i.test(f.name),
      );
      for (const imgFile of imageFiles) {
        const imgData = await ghFetch(ui, `/contents/${imgFile.path}`);
        images.push({
          name: imgFile.name,
          sha: imgFile.sha,
          content: imgData.content, // Base64
          path: imgFile.path,
        });
      }
    } catch (e) {
      console.warn("Could not fetch images", e);
    }

    return {
      title: data.title,
      description: data.description,
      date: data.date,
      tags: Array.isArray(data.tags) ? data.tags.join(", ") : data.tags,
      content: body.trim(),
      sha,
      path: cleanPath,
      images,
    };
  } catch (e) {
    console.error(e);
    throw new Error(`Failed to load post from GitHub: ${e.message}`);
  }
}
