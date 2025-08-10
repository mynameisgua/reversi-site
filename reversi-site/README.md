# Reversi / 黑白棋 — 單頁網站

這是一個以 **Vite + React + Tailwind CSS** 製作的黑白棋網站。

## 本機啟動
1. 安裝 Node.js（建議 v18 以上）。
2. 在此資料夾執行：
   ```bash
   npm install
   npm run dev
   ```
3. 開啟顯示的本機網址（預設 http://localhost:5173）。

## 打包
```bash
npm run build
npm run preview
```

## 一鍵部署（推薦：Vercel）
1. 將此專案推到 GitHub（或 GitLab/Bitbucket）。
2. 到 https://vercel.com/ 以 Git 匯入本專案（Framework 選 Vite，Build Command: `npm run build`，Output: `dist`）。
3. 部署完成後會得到一個 `https://你的專案.vercel.app` 的公開連結，直接分享即可玩。

## 其他部署
- **Netlify**：連結 Git repo，Build Command: `npm run build`，Publish directory: `dist`。
- **GitHub Pages**：在 Actions 設定 Vite 靜態部署（需設定 base 路徑）。
