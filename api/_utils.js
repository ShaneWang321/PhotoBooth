import { del, list, put } from "@vercel/blob";

const sessionIDPattern = /^[A-Za-z0-9_-]{8,80}$/;

export const uploadKinds = {
  photo: {
    fallbackName: "composed.jpg",
    contentTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
    extensions: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp"
    }
  },
  video: {
    fallbackName: "countdown.mp4",
    contentTypes: new Set(["video/mp4", "video/quicktime"]),
    extensions: {
      "video/mp4": "mp4",
      "video/quicktime": "mov"
    }
  }
};

export function corsHeaders() {
  return {
    "access-control-allow-origin": process.env.CORS_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-upload-token"
  };
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

export function jsonResponse(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      ...corsHeaders(),
      "cache-control": "no-store"
    }
  });
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      ...corsHeaders(),
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function methodNotAllowed() {
  return jsonResponse({ error: "method_not_allowed" }, 405);
}

export function blobAuthenticationMode(request) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return "read-write-token";
  }

  if (request?.headers?.get("x-vercel-oidc-token")) {
    return "oidc";
  }

  return "missing";
}

export function isBlobStorageConfigured(request) {
  return blobAuthenticationMode(request) !== "missing";
}

export function isAuthorized(request) {
  const expectedToken = process.env.PHOTOBOOTH_UPLOAD_TOKEN;
  if (!expectedToken) {
    return true;
  }

  const uploadToken = request.headers.get("x-upload-token");
  const authorization = request.headers.get("authorization") || "";
  const bearerToken = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7)
    : "";

  return uploadToken === expectedToken || bearerToken === expectedToken;
}

export function publicErrorMessage(error) {
  if (!error) {
    return "unknown_error";
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message || error.name || "unknown_error";
}

export function originFor(request) {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export function newSessionID() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function normalizeSessionID(value) {
  if (!value) {
    return newSessionID();
  }

  const trimmed = value.trim();
  if (!sessionIDPattern.test(trimmed)) {
    throw new Error("invalid_session_id");
  }

  return trimmed;
}

export function validateSessionID(value) {
  if (!value || !sessionIDPattern.test(value)) {
    throw new Error("invalid_session_id");
  }
}

export function sanitizeFileName(value, fallbackName, contentType, kindConfig) {
  const rawName = (value || fallbackName).trim() || fallbackName;
  const withoutPath = rawName.split(/[\\/]/).pop() || fallbackName;
  const safeName = withoutPath
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .slice(0, 80);

  const extension = kindConfig.extensions[contentType] || "bin";
  if (safeName.toLowerCase().endsWith(`.${extension}`)) {
    return safeName;
  }

  const baseName = safeName.replace(/\.[^.]+$/, "") || fallbackName.replace(/\.[^.]+$/, "");
  return `${baseName}.${extension}`;
}

export function manifestPath(sessionID) {
  return `sessions/${sessionID}/manifest.json`;
}

export async function readManifest(sessionID) {
  const path = manifestPath(sessionID);
  const result = await list({
    prefix: path,
    limit: 1
  });

  const manifestBlob = result.blobs.find((blob) => blob.pathname === path);
  if (!manifestBlob) {
    return null;
  }

  const response = await fetch(manifestBlob.url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function listSessionManifests({ limit = 100, cursor } = {}) {
  const targetCount = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const manifests = [];
  let nextCursor = cursor || undefined;
  let hasMore = true;
  let pageCount = 0;

  while (manifests.length < targetCount && hasMore && pageCount < 8) {
    const result = await list({
      prefix: "sessions/",
      limit: Math.min(1000, Math.max(100, (targetCount - manifests.length) * 4)),
      cursor: nextCursor
    });

    const manifestBlobs = result.blobs.filter((blob) => blob.pathname.endsWith("/manifest.json"));
    const pageManifests = await Promise.all(
      manifestBlobs.map(async (blob) => {
        try {
          const response = await fetch(blob.url, { cache: "no-store" });
          if (!response.ok) {
            return null;
          }
          return response.json();
        } catch {
          return null;
        }
      })
    );

    manifests.push(...pageManifests.filter(Boolean));
    hasMore = Boolean(result.hasMore && result.cursor);
    nextCursor = result.cursor;
    pageCount += 1;
  }

  manifests.sort((a, b) => {
    const left = Date.parse(a.updatedAt || a.createdAt || "") || 0;
    const right = Date.parse(b.updatedAt || b.createdAt || "") || 0;
    return right - left;
  });

  return {
    manifests: manifests.slice(0, targetCount),
    cursor: hasMore ? nextCursor : null,
    hasMore
  };
}

export async function deleteSessionBlobs(sessionID) {
  validateSessionID(sessionID);

  const result = await list({
    prefix: `sessions/${sessionID}/`,
    limit: 1000
  });
  const paths = result.blobs.map((blob) => blob.pathname);

  if (!paths.length) {
    return {
      deleted: false,
      paths: []
    };
  }

  await del(paths);

  return {
    deleted: true,
    paths
  };
}

export async function writeManifest(manifest) {
  await put(manifestPath(manifest.id), JSON.stringify(manifest, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 60
  });
}

export function buildShareFields(manifest, request) {
  const origin = originFor(request);
  const shareUrl = `${origin}/s/${manifest.id}`;
  return {
    ...manifest,
    shareUrl,
    qrValue: shareUrl,
    qrSvgUrl: `${origin}/qr/${manifest.id}.svg`
  };
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
