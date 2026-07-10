#!/usr/bin/env node
// Backfill: recompute tier + community fields on all existing KOLs
// using the current logic in src/lib/utils.ts and src/app/api/discover/route.ts.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-kol-scoring.mjs --dry-run
//   node --env-file=.env.local scripts/backfill-kol-scoring.mjs --apply

import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const DRY_RUN = args.has('--dry-run') || !args.has('--apply')

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local')
  process.exit(1)
}
const supabase = createClient(url, key)

// ---- Language detection (mirrors src/lib/utils.ts detectLanguage) ----
function detectLanguage(bio, displayName) {
  const text = `${displayName ?? ''} ${bio ?? ''}`
  if (!text.trim()) return 'en'

  const zhChars = text.match(/[一-鿿㐀-䶿]/g)?.length ?? 0
  const koChars = text.match(/[가-힯ᄀ-ᇿ]/g)?.length ?? 0
  const viDiacritics = text.match(/[ăâđêôơư]/gi)?.length ?? 0
  const trChars = text.match(/[ğışçöüĞİŞÇÖÜ]/g)?.length ?? 0
  const totalLen = text.replace(/\s+/g, '').length || 1

  const zhRatio = zhChars / totalLen
  const koRatio = koChars / totalLen

  if (zhRatio > 0.15 && koRatio > 0.05) return 'bilingual'
  if (zhRatio > 0.1 || zhChars >= 5) return 'zh'
  if (koRatio > 0.1 || koChars >= 5) return 'ko'
  if (viDiacritics >= 3) return 'vi'
  if (trChars >= 3) return 'tr'
  return 'en'
}

// ---- Tier logic (mirrors src/lib/utils.ts computeTier) ----
function computeTier(followers, rate) {
  const r = rate ?? 0
  if (followers >= 30_000) return 'A'
  if (followers >= 15_000 && r >= 1) return 'A'
  if (followers >= 5_000 || (followers >= 3_000 && r >= 2)) return 'B'
  return 'C'
}

// ---- PM classification signals (mirrors src/lib/discover-profile.ts) ----
const CORE_PM_TERMS = [
  'prediction market', 'prediction markets', 'forecast market', 'forecast markets',
  'event market', 'event markets',
  'polymarket', 'kalshi', 'manifold', 'polycop',
  'predict.fun', 'predictfun', 'predictdotfun',
  'limitless', 'limitless exchange', 'myriad', 'myriad markets',
  'augur', 'zeitgeist', '预测市场',
]

const PM_AIRDROP_TERMS = [
  // English
  'airdrop', 'airdrops', 'airdrop hunter', 'airdrop farmer',
  'points', 'points program', 'points hunter',
  'farming', 'farmer', 'farming alpha', 'alpha hunter',
  'testnet', 'mainnet', 'referral', 'referral code',
  'early access', 'early adopter', 'early user',
  'incentive', 'incentives', 'quest', 'quests',
  'launchpad', 'whitelist', 'ido', 'ieo', 'eligible', 'degen airdrop',
  // Chinese
  '空投', '撸毛', '积分', '早期', '交互', '内测',
  '空投猎手', '羊毛党', '撸空投', '捡毛', '打新', '首发',
  '内测号', '早鸟', '白名单', '预留',
]

function countMatches(text, terms) {
  const lower = (text ?? '').toLowerCase()
  return terms.reduce((s, t) => s + (lower.includes(t) ? 1 : 0), 0)
}

// ---- Community detection (mirrors src/app/api/discover/route.ts detectCommunity) ----
function isCommunityLink(url) {
  const lower = url.toLowerCase()
  return (
    lower.includes('t.me/') || lower.includes('telegram.me/') ||
    lower.includes('discord.gg/') || lower.includes('discord.com/invite/') ||
    lower.includes('wa.me/') || lower.includes('chat.whatsapp.com/') ||
    lower.includes('reddit.com/r/') || lower.includes('circle.') ||
    lower.includes('guild.xyz') || lower.includes('群') || lower.includes('group')
  )
}

function detectCommunity(bio) {
  if (!bio) return { has: false, links: [], platforms: [] }

  const patterns = [
    /https?:\/\/t\.me\/[\w-]+/g,
    /https?:\/\/telegram\.me\/[\w-]+/g,
    /https?:\/\/discord\.gg\/[\w-]+/g,
    /https?:\/\/discord\.com\/invite\/[\w-]+/g,
    /https?:\/\/wa\.me\/[\d]+/g,
    /https?:\/\/chat\.whatsapp\.com\/[\w]+/g,
    /https?:\/\/reddit\.com\/r\/[\w-]+/g,
    /t\.me\/[\w-]+/g,
    /discord\.gg\/[\w-]+/g,
    /discord\.com\/invite\/[\w-]+/g,
    /wa\.me\/[\d]+/g,
  ]
  const links = []
  for (const p of patterns) {
    const m = bio.match(p)
    if (m) links.push(...m)
  }

  const tg = bio.match(/tg:\s*@?([\w-]+)/gi)
  if (tg) for (const m of tg) links.push(`t.me/${m.replace(/^tg:\s*@?/i, '')}`)

  const generic = bio.match(/https?:\/\/[^\s),\]]+/g) ?? []
  for (const u of generic) if (isCommunityLink(u)) links.push(u)

  const zh = /(?:电报|telegram|tg|discord|群|社群|频道|channel)[^\n]*?(https?:\/\/[^\s),\]]+|t\.me\/[\w-]+|discord\.gg\/[\w-]+)/gi
  const zhMatches = bio.matchAll(zh)
  for (const m of zhMatches) if (m[1]) links.push(m[1])

  const uniqueLinks = [...new Set(links)]
  const platforms = []
  for (const l of uniqueLinks) {
    const low = l.toLowerCase()
    if (low.includes('t.me') || low.includes('telegram')) platforms.push('telegram')
    else if (low.includes('discord')) platforms.push('discord')
    else if (low.includes('whatsapp') || low.includes('wa.me')) platforms.push('whatsapp')
    else if (low.includes('reddit')) platforms.push('reddit')
  }
  return {
    // Strict rule: only true when we actually have an extractable URL. Keyword-only mentions → 无.
    has: uniqueLinks.length > 0,
    links: uniqueLinks,
    platforms: [...new Set(platforms)],
  }
}

// ---- Main ----
async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'APPLY (will write)'}`)

  const { data: kols, error } = await supabase
    .from('kols')
    .select('id, x_handle, display_name, bio, followers_count, avg_engagement_rate, tier, language, has_private_community, community_links, community_platforms, pm_brand_signal, airdrop_signal')
  if (error) {
    console.error('Failed to fetch KOLs:', error.message)
    process.exit(1)
  }
  console.log(`Loaded ${kols.length} KOLs`)

  const tierMoves = { A_up: 0, B_up: 0, C_up: 0, A_down: 0, B_down: 0, unchanged: 0 }
  const typeCounts = { pm_trader: 0, pm_airdrop: 0, unclassified: 0 }
  const langMoves = { to_zh: 0, to_en: 0, to_ko: 0, to_bilingual: 0, other: 0 }
  const communityNewlyDetected = []
  const changes = []

  for (const k of kols) {
    const newTier = computeTier(k.followers_count ?? 0, k.avg_engagement_rate)
    const newLang = detectLanguage(k.bio, k.display_name)
    const community = detectCommunity(k.bio)
    const textForScoring = `${k.display_name ?? ''}\n${k.bio ?? ''}`
    const newPmBrand = countMatches(textForScoring, CORE_PM_TERMS)
    const newAirdrop = countMatches(textForScoring, PM_AIRDROP_TERMS)
    const kolType = newAirdrop >= 1 ? 'pm_airdrop' : newPmBrand >= 1 ? 'pm_trader' : 'unclassified'
    typeCounts[kolType]++

    const oldLinks = new Set(k.community_links ?? [])
    const newLinks = new Set(community.links)
    const linksChanged =
      oldLinks.size !== newLinks.size ||
      [...newLinks].some((l) => !oldLinks.has(l))

    const oldPlatforms = new Set(k.community_platforms ?? [])
    const newPlatforms = new Set(community.platforms)
    const platformsChanged =
      oldPlatforms.size !== newPlatforms.size ||
      [...newPlatforms].some((p) => !oldPlatforms.has(p))

    const tierChanged = newTier !== k.tier
    const langChanged = newLang !== k.language
    const communityFlagChanged = community.has !== !!k.has_private_community
    const pmBrandChanged = newPmBrand !== (k.pm_brand_signal ?? 0)
    const airdropChanged = newAirdrop !== (k.airdrop_signal ?? 0)

    if (langChanged) {
      const key = `to_${newLang}`
      if (key in langMoves) langMoves[key]++
      else langMoves.other++
    }

    const dirty = tierChanged || langChanged || communityFlagChanged || linksChanged || platformsChanged || pmBrandChanged || airdropChanged
    if (!dirty) {
      tierMoves.unchanged++
      continue
    }

    if (tierChanged) {
      const key = (from, to) => `${from}_${to}`
      const move = key(k.tier, newTier)
      if (move === 'B_A' || move === 'C_A') tierMoves.A_up++
      else if (move === 'C_B') tierMoves.B_up++
      else if (move === 'A_B' || move === 'A_C') tierMoves.A_down++
      else if (move === 'B_C') tierMoves.B_down++
    }
    if (!k.has_private_community && community.has) {
      communityNewlyDetected.push({ handle: k.x_handle, links: [...newLinks] })
    }

    changes.push({
      id: k.id,
      handle: k.x_handle,
      followers: k.followers_count,
      tier: { old: k.tier, new: newTier, changed: tierChanged },
      language: { old: k.language, new: newLang, changed: langChanged },
      community: {
        old_has: !!k.has_private_community,
        new_has: community.has,
        old_links: [...oldLinks],
        new_links: [...newLinks],
        old_platforms: [...oldPlatforms],
        new_platforms: [...newPlatforms],
      },
      signals: {
        pm_brand: { old: k.pm_brand_signal ?? 0, new: newPmBrand },
        airdrop:  { old: k.airdrop_signal ?? 0, new: newAirdrop },
        kol_type: kolType,
      },
    })
  }

  console.log('\n=== Summary ===')
  console.log(`Unchanged:              ${tierMoves.unchanged}`)
  console.log(`Rows needing update:    ${changes.length}`)
  console.log('\n--- Tier changes ---')
  console.log(`Promoted to A (大V):    ${tierMoves.A_up}`)
  console.log(`Promoted to B (KOL):    ${tierMoves.B_up}`)
  console.log(`Downgraded A → B/C:     ${tierMoves.A_down}`)
  console.log(`Downgraded B → C:       ${tierMoves.B_down}`)
  console.log(`\n--- KOL type classification ---`)
  console.log(`PM Trader:               ${typeCounts.pm_trader}`)
  console.log(`PM 撸毛:                 ${typeCounts.pm_airdrop}`)
  console.log(`未分类:                  ${typeCounts.unclassified}`)
  console.log(`\n--- Language re-detection ---`)
  console.log(`Relabeled to zh:         ${langMoves.to_zh}`)
  console.log(`Relabeled to en:         ${langMoves.to_en}`)
  console.log(`Relabeled to bilingual:  ${langMoves.to_bilingual}`)
  console.log(`Relabeled to ko:         ${langMoves.to_ko}`)
  console.log(`Relabeled to other:      ${langMoves.other}`)
  console.log(`\nCommunity newly detected: ${communityNewlyDetected.length}`)
  if (communityNewlyDetected.length > 0) {
    for (const c of communityNewlyDetected.slice(0, 15)) {
      console.log(`  @${c.handle} → ${c.links.slice(0, 2).join(', ')}`)
    }
  }

  if (DRY_RUN) {
    console.log('\n(Dry run — no writes performed. Re-run with --apply to persist.)')
    console.log(`Sample of first 5 changes:`)
    for (const c of changes.slice(0, 5)) {
      console.log(JSON.stringify(c, null, 2))
    }
    return
  }

  console.log('\nApplying updates…')
  let ok = 0, fail = 0
  for (const c of changes) {
    const { error: err } = await supabase
      .from('kols')
      .update({
        tier: c.tier.new,
        language: c.language.new,
        has_private_community: c.community.new_has,
        community_links: c.community.new_links.length > 0 ? c.community.new_links : null,
        community_platforms: c.community.new_platforms.length > 0 ? c.community.new_platforms : null,
        pm_brand_signal: c.signals.pm_brand.new,
        airdrop_signal:  c.signals.airdrop.new,
      })
      .eq('id', c.id)
    if (err) {
      console.error(`  ✗ @${c.handle}: ${err.message}`)
      fail++
    } else {
      ok++
    }
  }
  console.log(`\nDone. Updated: ${ok}   Failed: ${fail}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
