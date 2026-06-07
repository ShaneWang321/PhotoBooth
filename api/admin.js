import {
  buildShareFields,
  isAuthorized,
  jsonResponse,
  listSessionManifests,
  methodNotAllowed,
  optionsResponse,
  publicErrorMessage
} from "./_utils.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    if (request.method !== "GET") {
      return methodNotAllowed();
    }

    if (!isAuthorized(request)) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    try {
      const url = new URL(request.url);
      const limit = Number(url.searchParams.get("limit") || 100);
      const cursor = url.searchParams.get("cursor") || undefined;
      const result = await listSessionManifests({ limit, cursor });
      const sessions = result.manifests.map((manifest) => serializeSession(buildShareFields(manifest, request)));

      return jsonResponse({
        ok: true,
        count: sessions.length,
        hasMore: result.hasMore,
        cursor: result.cursor,
        sessions
      });
    } catch (error) {
      console.error("photobooth_admin_failed", error);
      return jsonResponse({
        error: "admin_list_failed",
        message: publicErrorMessage(error)
      }, 500);
    }
  }
};

function serializeSession(manifest) {
  return {
    id: manifest.id,
    createdAt: manifest.createdAt || null,
    updatedAt: manifest.updatedAt || manifest.createdAt || null,
    shareUrl: manifest.shareUrl,
    qrValue: manifest.qrValue,
    qrSvgUrl: manifest.qrSvgUrl,
    files: {
      photo: serializeFile(manifest.files?.photo),
      video: serializeFile(manifest.files?.video)
    }
  };
}

function serializeFile(file) {
  if (!file) {
    return null;
  }

  return {
    url: file.url,
    downloadUrl: file.downloadUrl || file.url,
    pathname: file.pathname,
    contentType: file.contentType,
    filename: file.filename,
    size: Number(file.size || 0),
    uploadedAt: file.uploadedAt || null
  };
}
