import '@/styles/globals.css'
import 'react-image-crop/dist/ReactCrop.css'
import type { AppProps } from 'next/app'
import { RouteProgress } from '@/components/Loader'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <RouteProgress />
      <Component {...pageProps} />
    </>
  )
}
