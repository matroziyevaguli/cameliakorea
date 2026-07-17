import '@/styles/globals.css'
import 'react-image-crop/dist/ReactCrop.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { RouteProgress } from '@/components/Loader'

export default function App({ Component, pageProps }: AppProps) {
  // Register the root-scoped service worker so Chrome offers PWA install.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    }
  }, [])

  return (
    <>
      <RouteProgress />
      <Component {...pageProps} />
    </>
  )
}
