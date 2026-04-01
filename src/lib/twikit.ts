function resolveTwikitUrl(): string {
  if (process.env.TWIKIT_INTERNAL_API_URL) return process.env.TWIKIT_INTERNAL_API_URL
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL
  if (site) {
    const origin = site.startsWith('http') ? site : `https://${site}`
    return `${origin}/api/xbridge`
  }
  return 'http://localhost:3000/api/xbridge'
}
const baseUrl = resolveTwikitUrl()

async function callTwikit<T>(action: string, payload: unknown): Promise<T> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...((payload as Record<string, unknown>) ?? {}) }),
    cache: 'no-store',
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error ?? 'Twikit request failed')
  }

  return json as T
}

export interface TwikitUser {
  id: string
  created_at: string | null
  name: string
  screen_name: string
  description: string
  followers_count: number
  following_count: number
  statuses_count: number
  profile_image_url: string | null
}

export interface TwikitTweet {
  id: string
  created_at: string | null
  text: string
  reply_count: number
  retweet_count: number
  favorite_count: number
  view_count: number | string
  lang: string | null
  user: TwikitUser | null
}

export function getTwikitUser(screenName: string) {
  return callTwikit<TwikitUser>('user', { screen_name: screenName })
}

export async function tryGetTwikitUser(screenName: string) {
  try {
    const user = await getTwikitUser(screenName)
    return user.id ? user : null
  } catch {
    return null
  }
}

export function searchTwikitTweets(query: string, count = 20) {
  return callTwikit<TwikitTweet[]>('tweet-search', { query, count })
}

export function searchTwikitUsers(query: string, count = 20) {
  return callTwikit<TwikitUser[]>('user-search', { query, count })
}

export function getTwikitUserTweets(userId: string, count = 20) {
  return callTwikit<TwikitTweet[]>('user-tweets', { user_id: userId, count })
}
