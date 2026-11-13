import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        {/* Primary Meta Tags */}
        <title>Wishes &amp; DOOs — Fund your wishes, finish your DOOs</title>
        <meta
          name="description"
          content="A calm, multi-tenant personal finance, wishlist, and task workspace. Track finances, save for wishes, and organize DOOs with clear explicit controls."
        />
        <meta name="theme-color" content="#09090b" />
        <meta name="color-scheme" content="dark light" />
        <link rel="canonical" href="https://wishesanddoos.app/welcome" />

        {/* Mobile / PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Wishes &amp; DOOs" />

        {/* Open Graph / Facebook */}
        <meta property="og:site_name" content="Wishes &amp; DOOs" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://wishesanddoos.app/welcome" />
        <meta
          property="og:title"
          content="Wishes &amp; DOOs — Fund your wishes, finish your DOOs"
        />
        <meta
          property="og:description"
          content="A calm, multi-tenant personal finance, wishlist, and task workspace. Track finances, save for wishes, and organize DOOs."
        />
        <meta property="og:image" content="https://wishesanddoos.app/assets/images/icon.png" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Wishes &amp; DOOs — Fund your wishes, finish your DOOs" />
        <meta
          name="twitter:description"
          content="A calm, multi-tenant personal finance, wishlist, and task workspace."
        />
        <meta name="twitter:image" content="https://wishesanddoos.app/assets/images/icon.png" />

        {/* Font Preconnect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Wishes & DOOs",
              url: "https://wishesanddoos.app",
              description:
                "A calm, multi-tenant personal finance, wishlist, and task workspace. Track finances, save for wishes, and organize DOOs.",
              applicationCategory: "FinanceApplication",
              operatingSystem: "All",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
