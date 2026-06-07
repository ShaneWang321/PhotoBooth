# PhotoBooth QR Backend

這是一個可以直接部署到 Vercel 的 QR code 後端 MVP。它負責：

- 接收 PhotoBooth App 上傳的成品照片或倒數影片。
- 將檔案存到 Vercel Blob。
- 產生分享頁 URL。
- 產生 QR code SVG。
- 讓使用者掃碼後下載成品。

## 架構

```text
PhotoBooth App
  POST /api/upload
    -> Vercel Function
    -> Vercel Blob
    -> manifest.json
    <- shareUrl / qrValue / qrSvgUrl

User
  scan QR
    -> /s/{sessionId}
    -> download photo or video
```

## GitHub + Vercel 部署

1. 將這個後端專案推到 GitHub，或保留在 iOS app 的 monorepo 裡。
2. 到 Vercel 新增 Project，Import GitHub repo。
3. 如果 repo 根目錄就是這個後端專案，Vercel 的 Root Directory 使用：

```text
./
```

如果放在 iOS app monorepo 的 `qrcode-backend/` 資料夾，Root Directory 才設為：

```text
qrcode-backend
```

4. 在 Vercel 專案中新增或連接 Blob Storage。
5. 確認 Blob Store 已連接到 Vercel Project。新版 Vercel Blob 可使用 OIDC；舊版或手動設定也可以使用 `BLOB_READ_WRITE_TOKEN`。
6. 到 Project Settings -> Environment Variables 新增：

```text
PHOTOBOOTH_UPLOAD_TOKEN=一組夠長的隨機密碼
PUBLIC_BASE_URL=https://你的專案.vercel.app
CORS_ORIGIN=*
```

7. Deploy。
8. 開啟：

```text
https://你的專案.vercel.app/health
```

看到 `{"ok":true}` 就代表 API 起來了。建議同時確認 `configuration.blobStorage` 與 `configuration.uploadToken` 都是 `true`：

```json
{
  "ok": true,
  "configuration": {
    "blobStorage": true,
    "blobAuthMode": "oidc",
    "uploadToken": true,
    "publicBaseUrl": true
  }
}
```

`blobAuthMode` 可能是 `oidc` 或 `read-write-token`。如果 `/api/upload` 回 Blob 相關錯誤，通常是 Blob Store 尚未連接到這個 Project，或 `BLOB_READ_WRITE_TOKEN`/OIDC 沒有套用到目前部署環境。

## API

### 健康檢查

```http
GET /health
```

### 上傳照片

```sh
curl -X POST 'https://你的專案.vercel.app/api/upload?kind=photo&filename=composed.jpg' \
  -H 'content-type: image/jpeg' \
  -H 'x-upload-token: 你的 PHOTOBOOTH_UPLOAD_TOKEN' \
  --data-binary '@composed.jpg'
```

回傳重點：

```json
{
  "ok": true,
  "sessionId": "7f9d4d6b4b4d4d0f8c1e8a4f8173d2bd",
  "shareUrl": "https://你的專案.vercel.app/s/7f9d4d6b4b4d4d0f8c1e8a4f8173d2bd",
  "qrValue": "https://你的專案.vercel.app/s/7f9d4d6b4b4d4d0f8c1e8a4f8173d2bd",
  "qrSvgUrl": "https://你的專案.vercel.app/qr/7f9d4d6b4b4d4d0f8c1e8a4f8173d2bd.svg"
}
```

App 可以把 `qrValue` 交給既有的 `QRService` 產生 QR 圖，也可以直接顯示 `qrSvgUrl`。

### 補上同一組 session 的影片

```sh
curl -X POST 'https://你的專案.vercel.app/api/upload?kind=video&sessionId=上一步的sessionId&filename=countdown.mp4' \
  -H 'content-type: video/mp4' \
  -H 'x-upload-token: 你的 PHOTOBOOTH_UPLOAD_TOKEN' \
  --data-binary '@countdown.mp4'
```

### 取得 session manifest

```http
GET /api/session?id={sessionId}
```

### 取得 QR SVG

```http
GET /qr/{sessionId}.svg
```

或：

```http
GET /api/qrcode?value=https%3A%2F%2Fexample.com
```

## Swift 對接範例

```swift
func uploadPhoto(url: URL, endpoint: URL, token: String) async throws -> URL {
    var request = URLRequest(url: endpoint)
    request.httpMethod = "POST"
    request.setValue("image/jpeg", forHTTPHeaderField: "content-type")
    request.setValue(token, forHTTPHeaderField: "x-upload-token")
    request.httpBody = try Data(contentsOf: url)

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse,
          (200..<300).contains(httpResponse.statusCode) else {
        throw URLError(.badServerResponse)
    }

    struct UploadResponse: Decodable {
        let qrValue: String
    }

    let decoded = try JSONDecoder().decode(UploadResponse.self, from: data)
    return URL(string: decoded.qrValue)!
}
```

endpoint 範例：

```text
https://你的專案.vercel.app/api/upload?kind=photo&filename=composed.jpg
```

## 目前限制

- 這版是最小可用 MVP，適合先上傳成品照片。
- Vercel Function 的 request/response payload 上限是 4.5MB，大檔倒數影片可能不適合直接 POST 到 `/api/upload`。
- 若倒數影片常常超過限制，下一版應改成 Vercel Blob client upload 或另外接 S3/R2 presigned upload。
- `PHOTOBOOTH_UPLOAD_TOKEN` 請務必設定；若未設定，後端會允許上傳，僅適合本機測試。

## 下一步建議

- 倒數影片若要一起掃碼下載，改走 Vercel Blob client upload 或 S3/R2 presigned upload，避開 Function 4.5MB payload 限制。
- 增加自動刪除策略，例如保留 7 天或 30 天。
- 增加後台清單頁，方便活動後批次檢查、下載或刪除 session。
