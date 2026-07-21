import Document, { DocumentContext, DocumentInitialProps, Head, Html, Main, NextScript } from 'next/document'

type Props = DocumentInitialProps & { locale?: string }

export default function AppDocument({ locale }: Props) {
  return (
    <Html lang={locale || 'en'}>
      <Head>
        <link rel="icon" type="image/png" sizes="256x256" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* PWA */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#F4628E" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Camelia" />
        {/* No blanket robots meta here: it would also hide the PUBLIC store (/ and
            /product/*). The private areas (careers, admin, seller, login) are kept
            noindex by the X-Robots-Tag headers in next.config.js. */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}

AppDocument.getInitialProps = async (ctx: DocumentContext): Promise<Props> => {
  const initialProps = await Document.getInitialProps(ctx)
  return { ...initialProps, locale: ctx.locale }
}
