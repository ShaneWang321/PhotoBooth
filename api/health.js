import { jsonResponse, methodNotAllowed, optionsResponse } from "./_utils.js";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    if (request.method !== "GET") {
      return methodNotAllowed();
    }

    return jsonResponse({
      ok: true,
      service: "photobooth-qrcode-backend",
      time: new Date().toISOString()
    });
  }
};
