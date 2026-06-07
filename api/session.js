import {
  buildShareFields,
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
  readManifest,
  validateSessionID
} from "./_utils.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    if (request.method !== "GET") {
      return methodNotAllowed();
    }

    const url = new URL(request.url);
    const sessionID = url.searchParams.get("id");

    try {
      validateSessionID(sessionID);
    } catch {
      return jsonResponse({ error: "invalid_session_id" }, 400);
    }

    const manifest = await readManifest(sessionID);
    if (!manifest) {
      return jsonResponse({ error: "not_found" }, 404);
    }

    return jsonResponse(buildShareFields(manifest, request));
  }
};
