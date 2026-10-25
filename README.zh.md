# xdoku

使用 Expo 與 TypeScript 在 Windows 開發的 iPhone 貓咪邏輯遊戲。名稱與美術尚未定案。

## 開發

使用 Node.js 22.16 或更新版本。在 `mobile` 執行 `npm ci`，再執行 `npm start`。在 iPhone 使用相容的 Expo Go 或開發建置。`npm run web` 可開啟瀏覽器版本。

以 `npm test`、`npm run typecheck` 與 `npm run lint` 驗證。測試涵蓋唯一解、區域連通性、確定性生成、UTC 每日種子及放置規則。仍須進行 iPhone 實機測試。

依賴稽核目前在 Expo CLI 間接使用的 node-forge／zod 套件中回報五項高嚴重性問題。相容的自動修正未能清除，發佈前須重新評估上游更新。

## 狀態與路線

已實作：5×5 唯一解棋盤、編號關卡、UTC 每日棋盤、放置與排除工具、衝突回饋、復原、揭示、重玩及本機儲存。目前介面為繁體中文。

上架前：擴充目前少量的解答排列模式與難度評級，加入推理提示、多語系、不依賴顏色的區域識別、原創素材與裝置測試。

排行榜需要可信任後端與分數驗證，並區分使用提示的紀錄。購買功能需要 Apple 商品、權益驗證及回復購買。目前兩項服務均未串接，不收取款項，也不提供虛構排名。

發佈需要 Apple Developer 與 Expo 帳號、正式 bundle identifier、EAS 設定、簽署、TestFlight 測試、隱私揭露、支援與隱私頁面、商店素材及送審。此原型尚未達到送審標準。請勿將憑證放入 Git。

英文版本：[English](README.md)。
