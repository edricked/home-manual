import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

const githubPagesBaseUrl =
  process.env.GITHUB_PAGES === 'true' ? '/home-manual' : '';

export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="application-name" content="Home Manual" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Home Manual" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="theme-color"
          content="#F8F7F3"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#17251F"
          media="(prefers-color-scheme: dark)"
        />
        <link
          rel="apple-touch-icon"
          href={`${githubPagesBaseUrl}/apple-touch-icon.png`}
        />
        <link
          rel="manifest"
          href={`${githubPagesBaseUrl}/manifest.webmanifest`}
        />
        <ScrollViewStyleReset />
        <script
          src={`${githubPagesBaseUrl}/coi-serviceworker.js`}
          suppressHydrationWarning
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
