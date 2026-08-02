import "./globals.css";

export const metadata = {
  title: "EvalOps",
  description: "Evaluation operations workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
