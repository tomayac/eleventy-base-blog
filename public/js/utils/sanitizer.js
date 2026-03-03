let domPurifyPromise = null;

export async function sanitizeHTML(container, html) {
  const config = {
    ADD_ATTR: ["loading", "decoding"],
    ADD_TAGS: ["figure", "figcaption"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|ftp|blob|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-]|$))/i,
  };

  if ("setHTML" in container) {
    try {
      container.setHTML(html);
      if (html.includes("src=") && !container.querySelector("[src]")) {
        throw new Error("Native Sanitizer stripped src");
      }
      return;
    } catch (e) {
      console.error(e);
    }
  }

  if (!window.DOMPurify && !domPurifyPromise) {
    const link = document.createElement("link");
    link.rel = "modulepreload";
    link.href = "/js/purify.min.js";
    document.head.appendChild(link);

    domPurifyPromise = (async () => {
      try {
        await import("/js/purify.min.js");
        return window.DOMPurify;
      } catch (e) {
        return new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "/js/purify.min.js";
          script.onload = () => resolve(window.DOMPurify);
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
    })();
  }

  const purify = window.DOMPurify || (await domPurifyPromise);
  if (purify && purify.sanitize) {
    container.innerHTML = purify.sanitize(html, config);
  } else {
    container.innerHTML = html;
  }
}
