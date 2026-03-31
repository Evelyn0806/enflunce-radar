import { TwikitTweet, TwikitUser } from '@/lib/twikit'

const bearer = process.env.TWITTER_BEARER_TOKEN

function xHeaders() {
  return { Authorization: `Bearer ${bearer}` }
}

export function hasXApiFallback() {
  return Boolean(bearer)
}

export async function fetchXUserByHandle(handle: string): Promise<TwikitUser | null> {
  if (!bearer) return null

  const params = new URLSearchParams({
    'user.fields': 'public_metrics,description,profile_image_url,created_at',
  })

  const res = await fetch(`https://api.twitter.com/2/users/by/username/${handle}?${params}`, {
    headers: xHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) return null
  const json = await res.json()
  const user = json.data
  if (!user) return null

  return {
    id: user.id,
    created_at: user.created_at ?? null,
    name: user.name,
    screen_name: user.username,
    description: user.description ?? '',
    followers_count: user.public_metrics?.followers_count ?? 0,
    following_count: user.public_metrics?.following_count ?? 0,
    statuses_count: user.public_metrics?.tweet_count ?? 0,
    profile_image_url: user.profile_image_url ?? null,
  }
}

export async function fetchXUsersByHandles(handles: string[]) {
  const users = await Promise.all(handles.map((handle) => fetchXUserByHandle(handle.replace(/^@/, ''))))
  return users.filter(Boolean) as TwikitUser[]
}

export async function fetchXRecentTweetsByHandle(handle: string, count = 10): Promise<TwikitTweet[]> {
  if (!bearer) return []

  const user = await fetchXUserByHandle(handle)
  if (!user?.id) return []

  const params = new URLSearchParams({
    max_results: String(Math.min(100, count)),
    'tweet.fields': 'created_at,public_metrics,lang',
  })

  const res = await fetch(`https://api.twitter.com/2/users/${user.id}/tweets?${params}`, {
    headers: xHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) return []
  const json = await res.json()
  const tweets = json.data ?? []

  return tweets.map((tweet: any) => ({
    id: tweet.id,
    created_at: tweet.created_at ?? null,
    text: tweet.text ?? '',
    reply_count: tweet.public_metrics?.reply_count ?? 0,
    retweet_count: tweet.public_metrics?.retweet_count ?? 0,
    favorite_count: tweet.public_metrics?.like_count ?? 0,
    view_count: tweet.public_metrics?.impression_count ?? 0,
    lang: tweet.lang ?? null,
    user,
  }))
}
