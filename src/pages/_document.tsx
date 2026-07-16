import Document, { DocumentContext, DocumentInitialProps, Head, Html, Main, NextScript } from 'next/document'

type Props = DocumentInitialProps & { locale?: string }

export default function AppDocument({ locale }: Props) {
  return (
    <Html lang={locale || 'en'}>
      <Head>
        <link rel="icon" type="image/png" sizes="256x256" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#141412" />
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
        <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
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
