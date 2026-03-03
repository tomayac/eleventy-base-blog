import { fileOpen, fileSave } from "browser-fs-access";
import { customAlert } from "./dialog-utils.js";
import {
  saveBackendConfigs,
  updateBackendFields,
  updateGlobalConfig,
} from "./ai-config.js";
import { refreshAIVisibility, updateUIFields } from "./ai-toggle.js";

export function initSettingsFileHandler(ui) {
  const aiKeys = [
    "ai-backend",
    "ai-api-key",
    "ai-model-name",
    "ai-project-id",
    "ai-app-id",
    "ai-gemini-api-provider",
    "ai-use-app-check",
    "ai-recaptcha-site-key",
    "ai-use-limited-use-tokens",
    "ai-device",
    "ai-dtype",
  ];

  ui.saveSettingsBtn.onclick = async () => {
    const settings = {
      "gh-config": JSON.parse(localStorage.getItem("gh-config") || "{}"),
      "ai-features-enabled":
        localStorage.getItem("ai-features-enabled") === "true",
      "ai-only-existing-tags":
        localStorage.getItem("ai-only-existing-tags") === "true",
      "ai-backend": localStorage.getItem("ai-backend"),
      "ai-backend-configs": JSON.parse(
        localStorage.getItem("ai-backend-configs") || "{}",
      ),
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    try {
      await fileSave(blob, {
        fileName: "eleventy-blog-settings.json",
        extensions: [".json"],
        description: "Settings File",
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        customAlert(ui, "Failed to save settings: " + err.message);
      }
    }
  };

  ui.loadSettingsBtn.onclick = async () => {
    try {
      const blob = await fileOpen({
        extensions: [".json"],
        description: "Settings File",
      });
      const text = await blob.text();
      const settings = JSON.parse(text);

      if (settings["gh-config"]) {
        localStorage.setItem(
          "gh-config",
          JSON.stringify(settings["gh-config"]),
        );
        ["gh-token", "gh-owner", "gh-repo"].forEach((id) => {
          const key =
            id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + "Input";
          if (ui[key] && settings["gh-config"][id] !== undefined) {
            ui[key].value = settings["gh-config"][id];
          }
        });
      }

      if (settings["ai-features-enabled"] !== undefined) {
        localStorage.setItem(
          "ai-features-enabled",
          settings["ai-features-enabled"],
        );
        ui.aiFeaturesToggle.checked = settings["ai-features-enabled"];
      }

      if (settings["ai-only-existing-tags"] !== undefined) {
        localStorage.setItem(
          "ai-only-existing-tags",
          settings["ai-only-existing-tags"],
        );
        ui.aiOnlyExistingTagsToggle.checked = settings["ai-only-existing-tags"];
      }

      if (settings["ai-backend"] !== undefined) {
        localStorage.setItem("ai-backend", settings["ai-backend"]);
        ui.aiBackendSelect.value = settings["ai-backend"];
      }

      if (settings["ai-backend-configs"]) {
        saveBackendConfigs(settings["ai-backend-configs"]);
        updateUIFields(ui, settings["ai-backend-configs"], aiKeys);
      }

      updateBackendFields(ui);
      refreshAIVisibility(ui);
      updateGlobalConfig(ui);

      if (ui.aiFeaturesToggle.checked) {
        const { initAIFeatures } = await import("./ai-init.js");
        await initAIFeatures(
          ui,
          () => import("./create-post.js").then((m) => m.sync()),
          {
            renderPills: () =>
              import("./tag-editor.js").then((m) => m.renderPills()),
          },
        );
        window.dispatchEvent(
          new CustomEvent("ai-features-toggled", { detail: true }),
        );
      }

      customAlert(ui, "Settings loaded successfully!");
    } catch (err) {
      console.error(err);
      if (err.name !== "AbortError") {
        customAlert(ui, "Failed to load settings: " + err.message);
      }
    }
  };
}
