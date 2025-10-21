import "./globals.css";

export const metadata = {
  title: "木更津高専クレジットカウンター",
  description: "学科ごとの取得単位を集計する Web アプリケーション",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
