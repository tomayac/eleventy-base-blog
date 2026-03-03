export async function runTagGeneration(
  session,
  content,
  schema,
  addTags,
  isRestricted,
) {
  let full = "";
  const stream = session.promptStreaming(`Content: ${content}`, {
    responseConstraint: isRestricted
      ? schema
      : {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" } },
          },
        },
  });
  for await (const chunk of stream) {
    full += chunk;
    try {
      addTags(JSON.parse(full).tags);
    } catch (e) {}
  }
}
