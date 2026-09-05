import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'The Isle Garage — Your next chapter',
  description:
    'An interactive design preview for tracking your Evrima dinosaurs and favorite servers.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
