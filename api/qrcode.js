import QRCode from "qrcode";
import {
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
  originFor,
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
    const explicitValue = url.searchParams.get("value");
    const sessionID = url.searchParams.get("id");
    let value = explicitValue;

    if (!value && sessionID) {
      try {
        validateSessionID(sessionID);
      } catch {
        return jsonResponse({ error: "invalid_session_id" }, 400);
      }
      value = `${originFor(request)}/s/${sessionID}`;
    }

    if (!value) {
      return jsonResponse({ error: "missing_value" }, 400);
    }

    const svg = await QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 512,
      color: {
        dark: "#3f2833",
        light: "#ffffff"
      }
    });

    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=60"
      }
    });
  }
};
