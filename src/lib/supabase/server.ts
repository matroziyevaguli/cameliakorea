import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type GetServerSidePropsContext } from 'next'

export function createClient(ctx: GetServerSidePropsContext) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return ctx.req.cookies[name]
        },
        set(name: string, value: string, options: CookieOptions) {
          ctx.res.setHeader('Set-Cookie', serializeCookie(name, value, options))
        },
        remove(name: string, options: CookieOptions) {
          ctx.res.setHeader('Set-Cookie', serializeCookie(name, '', { ...options, maxAge: 0 }))
        },
      },
    }
  )
}

function serializeCookie(name: string, value: string, options: CookieOptions) {
  let cookie = `${name}=${value}`
  if (options.domain) cookie += `; Domain=${options.domain}`
  if (options.path) cookie += `; Path=${options.path}`
  if (options.maxAge != null) cookie += `; Max-Age=${options.maxAge}`
  if (options.expires) cookie += `; Expires=${new Date(options.expires).toUTCString()}`
  if (options.httpOnly) cookie += '; HttpOnly'
  if (options.secure) cookie += '; Secure'
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`
  return cookie
}