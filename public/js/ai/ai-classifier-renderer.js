import { getTaxonomy } from "./ai-taxonomy-loader.js";

export function updateScriptTagInContent(ui) {
  const classifierResults = Array.from(
    document.querySelectorAll(".classifier-result-row"),
  ).map((row) => ({
    id: row.getAttribute("data-category-id"),
    confidence:
      parseFloat(row.querySelector("td:last-child").textContent) / 100,
  }));
  let content = ui.contentInput.value.trim();

  content = content
    .replace(
      /\n*<script>[\s\S]*?googletag\.setConfig\(\{[\s\S]*?\}\);[\s\S]*?<\/script>/g,
      "",
    )
    .trimEnd();

  if (classifierResults.length > 0) {
    const ids = classifierResults.map((r) => String(r.id));
    const confidences = classifierResults.map((r) => r.confidence);
    const scriptTag = `<script>
  window.googletag = window.googletag || { cmd: [] };
  googletag.setConfig({
    pps: {
      taxonomies: {
        IAB_CONTENT_3_1: { values: ${JSON.stringify(ids)} },
        confidences: ${JSON.stringify(confidences)},
      },
    },
  });
</script>`;
    content = content + "\n\n" + scriptTag;
  }

  if (ui.contentInput.value !== content) {
    ui.contentInput.value = content;
    ui.contentInput.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

export function getSelectedClassifierIds() {
  return Array.from(document.querySelectorAll(".classifier-result-row")).map(
    (row) => row.getAttribute("data-category-id"),
  );
}

export async function renderClassifierResults(ui, results, updateCallback) {
  if (!results || results.length === 0) {
    ui.aiClassifierResults.innerHTML = "";
    return;
  }

  const taxonomy = await getTaxonomy();
  let html =
    "<table><thead><tr><th>Category</th><th>Confidence</th></tr></thead><tbody>";
  for (const res of results) {
    const categoryName = taxonomy[res.id] || res.id;
    html += `
			<tr class="classifier-result-row" data-category-id="${res.id}">
				<td>
					<span class="tag-pill classifier-pill">
						${categoryName}
						<button type="button" class="remove-tag" title="Remove category" onclick="this.closest('tr').remove(); window.dispatchEvent(new CustomEvent('classifier-updated'))">×</button>
					</span>
				</td>
				<td>${res.confidence ? Math.round(res.confidence * 100) + "%" : "-"}</td>
			</tr>`;
  }
  html += "</tbody></table>";
  ui.aiClassifierResults.innerHTML = html;
}

window.getSelectedClassifierIds = getSelectedClassifierIds;
window.renderClassifierResults = renderClassifierResults;
window.updateScriptTagInContent = updateScriptTagInContent;
