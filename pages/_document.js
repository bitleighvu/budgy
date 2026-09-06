import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="icon" type="image/svg+xml" href="/budgy.svg" />
        <link rel="apple-touch-icon" href="/budgy.jpg" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#4961eb" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Corben:wght@400;700&family=Space+Grotesk:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Plaid's vanilla-JS Link SDK — exposes window.Plaid.create(...) */}
        <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" defer></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}