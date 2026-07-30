import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Tìm Vần',
  description: 'Công cụ tìm vần tiếng Việt: vần đơn, vần đôi, vần 3, vần 4, vần đảo.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
