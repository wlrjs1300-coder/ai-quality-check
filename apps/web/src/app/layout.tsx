import "./globals.css";

export const metadata = {
  title: "EvalOps",
  description: "Local foundation scaffold",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
