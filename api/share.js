import {
  buildShareFields,
  escapeHTML,
  htmlResponse,
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
      return htmlResponse(notFoundPage(), 404);
    }

    return htmlResponse(renderSharePage(buildShareFields(manifest, request)));
  }
};

function renderSharePage(manifest) {
  const photo = manifest.files?.photo;
  const video = manifest.files?.video;
  const title = "PhotoBooth";

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #fff8ed;
      --panel: #fffefa;
      --ink: #442d3a;
      --berry: #c92e58;
      --line: #f5d96a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--paper);
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    main {
      width: min(720px, 100%);
      background: var(--panel);
      border: 3px solid var(--line);
      border-radius: 24px;
      box-shadow: 0 16px 50px rgba(68, 45, 58, 0.16);
      padding: clamp(20px, 5vw, 36px);
      text-align: center;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(34px, 8vw, 56px);
      line-height: 1;
      letter-spacing: 0;
    }
    p {
      margin: 0 0 22px;
      color: rgba(68, 45, 58, 0.74);
      font-size: 17px;
    }
    .preview {
      display: block;
      width: min(420px, 100%);
      margin: 0 auto 22px;
      border-radius: 18px;
      border: 2px solid rgba(201, 46, 88, 0.22);
      background: #fff;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
    }
    a {
      min-width: 168px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 52px;
      border-radius: 14px;
      padding: 0 18px;
      color: #fff;
      background: var(--berry);
      text-decoration: none;
      font-weight: 800;
    }
    a.secondary {
      color: var(--ink);
      background: #fff;
      border: 2px solid rgba(201, 46, 88, 0.28);
    }
    .empty {
      padding: 48px 16px;
      border-radius: 18px;
      background: #fff;
      border: 2px dashed rgba(201, 46, 88, 0.24);
    }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>掃描完成，可以下載這次的拍貼成品。</p>
    ${photo ? `<img class="preview" src="${escapeHTML(photo.url)}" alt="PhotoBooth result">` : `<div class="empty">照片尚未上傳完成</div>`}
    <div class="actions">
      ${photo ? `<a href="${escapeHTML(photo.downloadUrl || photo.url)}" download>下載照片</a>` : ""}
      ${video ? `<a class="secondary" href="${escapeHTML(video.downloadUrl || video.url)}" download>下載影片</a>` : ""}
    </div>
  </main>
</body>
</html>`;
}

function notFoundPage() {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>找不到照片</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #fff8ed;
      color: #442d3a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 24px;
      text-align: center;
    }
    main {
      max-width: 520px;
      background: #fffefa;
      border: 3px solid #f5d96a;
      border-radius: 24px;
      padding: 36px;
    }
  </style>
</head>
<body>
  <main>
    <h1>找不到照片</h1>
    <p>這個連結可能尚未完成上傳，或已被移除。</p>
  </main>
</body>
</html>`;
}
