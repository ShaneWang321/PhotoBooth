import { isBlobStorageConfigured, jsonResponse, methodNotAllowed, optionsResponse } from "./_utils.js";

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
      configuration: {
        blobStorage: isBlobStorageConfigured(),
        uploadToken: Boolean(process.env.PHOTOBOOTH_UPLOAD_TOKEN),
        publicBaseUrl: Boolean(process.env.PUBLIC_BASE_URL)
      },
      time: new Date().toISOString()
    });
  }
};
