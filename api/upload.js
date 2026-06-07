import { put } from "@vercel/blob";
import {
  buildShareFields,
  isAuthorized,
  jsonResponse,
  methodNotAllowed,
  normalizeSessionID,
  optionsResponse,
  readManifest,
  sanitizeFileName,
  uploadKinds,
  writeManifest
} from "./_utils.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    if (request.method !== "POST") {
      return methodNotAllowed();
    }

    if (!isAuthorized(request)) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") || "photo";
    const kindConfig = uploadKinds[kind];
    if (!kindConfig) {
      return jsonResponse({ error: "invalid_kind", allowedKinds: Object.keys(uploadKinds) }, 400);
    }

    const contentType = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!kindConfig.contentTypes.has(contentType)) {
      return jsonResponse({
        error: "unsupported_content_type",
        received: contentType || null,
        allowedContentTypes: Array.from(kindConfig.contentTypes)
      }, 415);
    }

    if (!request.body) {
      return jsonResponse({ error: "empty_body" }, 400);
    }

    let sessionID;
    try {
      sessionID = normalizeSessionID(url.searchParams.get("sessionId"));
    } catch {
      return jsonResponse({ error: "invalid_session_id" }, 400);
    }

    const now = new Date().toISOString();
    const filename = sanitizeFileName(
      url.searchParams.get("filename"),
      kindConfig.fallbackName,
      contentType,
      kindConfig
    );
    const pathname = `sessions/${sessionID}/${kind}-${filename}`;

    const blob = await put(pathname, request.body, {
      access: "public",
      contentType,
      allowOverwrite: true,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 30
    });

    const existingManifest = await readManifest(sessionID);
    const manifest = existingManifest || {
      id: sessionID,
      createdAt: now,
      files: {}
    };

    manifest.updatedAt = now;
    manifest.files[kind] = {
      url: blob.url,
      downloadUrl: blob.downloadUrl || blob.url,
      pathname: blob.pathname,
      contentType,
      filename,
      size: Number(request.headers.get("content-length") || 0),
      uploadedAt: now
    };

    const responseManifest = buildShareFields(manifest, request);
    await writeManifest(responseManifest);

    return jsonResponse({
      ok: true,
      sessionId: sessionID,
      shareUrl: responseManifest.shareUrl,
      qrValue: responseManifest.qrValue,
      qrSvgUrl: responseManifest.qrSvgUrl,
      file: responseManifest.files[kind],
      manifest: responseManifest
    }, 201);
  }
};
