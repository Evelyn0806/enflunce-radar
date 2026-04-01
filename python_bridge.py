import asyncio
from pathlib import Path
from types import MethodType
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from twikit import Client
from twikit.client import gql
from x_client_transaction import ClientTransaction as XClientTransaction
from x_client_transaction.utils import get_ondemand_file_url

SEARCH_FEATURES = {
    'rweb_video_screen_enabled': False,
    'profile_label_improvements_pcf_label_in_post_enabled': True,
    'responsive_web_profile_redirect_enabled': True,
    'rweb_tipjar_consumption_enabled': True,
    'verified_phone_label_enabled': False,
    'creator_subscriptions_tweet_preview_api_enabled': True,
    'responsive_web_graphql_timeline_navigation_enabled': True,
    'responsive_web_graphql_skip_user_profile_image_extensions_enabled': False,
    'premium_content_api_read_enabled': False,
    'communities_web_enable_tweet_community_results_fetch': True,
    'c9s_tweet_anatomy_moderator_badge_enabled': True,
    'responsive_web_grok_analyze_button_fetch_trends_enabled': False,
    'responsive_web_grok_analyze_post_followups_enabled': True,
    'responsive_web_jetfuel_frame': False,
    'responsive_web_grok_share_attachment_enabled': True,
    'responsive_web_grok_annotations_enabled': True,
    'articles_preview_enabled': True,
    'responsive_web_edit_tweet_api_enabled': True,
    'graphql_is_translatable_rweb_tweet_is_translatable_enabled': True,
    'view_counts_everywhere_api_enabled': True,
    'longform_notetweets_consumption_enabled': True,
    'responsive_web_twitter_article_tweet_consumption_enabled': True,
    'content_disclosure_indicator_enabled': True,
    'content_disclosure_ai_generated_indicator_enabled': True,
    'responsive_web_grok_show_grok_translated_post': False,
    'responsive_web_grok_analysis_button_from_backend': True,
    'post_ctas_fetch_enabled': True,
    'freedom_of_speech_not_reach_fetch_enabled': True,
    'standardized_nudges_misinfo': True,
    'tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled': True,
    'longform_notetweets_rich_text_read_enabled': True,
    'longform_notetweets_inline_media_enabled': True,
    'responsive_web_grok_image_annotation_enabled': True,
    'responsive_web_grok_imagine_annotation_enabled': True,
    'responsive_web_grok_community_note_auto_translation_is_enabled': True,
    'responsive_web_enhance_cards_enabled': False,
}

SEARCH_FIELD_TOGGLES = {
    'withPayments': False,
    'withAuxiliaryUserLabels': False,
    'withArticleRichContentState': False,
    'withArticlePlainText': False,
    'withArticleSummaryText': False,
    'withArticleVoiceOver': False,
    'withGrokAnalyze': False,
    'withDisallowedReplyControls': False,
}

USER_BY_SCREEN_NAME_FEATURES = {
    'hidden_profile_subscriptions_enabled': True,
    'profile_label_improvements_pcf_label_in_post_enabled': True,
    'responsive_web_profile_redirect_enabled': True,
    'rweb_tipjar_consumption_enabled': True,
    'verified_phone_label_enabled': True,
    'subscriptions_verification_info_is_identity_verified_enabled': True,
    'subscriptions_verification_info_verified_since_enabled': True,
    'highlights_tweets_tab_ui_enabled': True,
    'responsive_web_twitter_article_notes_tab_enabled': True,
    'subscriptions_feature_can_gift_premium': False,
    'creator_subscriptions_tweet_preview_api_enabled': True,
    'responsive_web_graphql_skip_user_profile_image_extensions_enabled': False,
    'responsive_web_graphql_timeline_navigation_enabled': True,
}

USER_BY_SCREEN_NAME_FIELD_TOGGLES = {
    'withAuxiliaryUserLabels': False,
}

USER_TWEETS_FEATURES = SEARCH_FEATURES
USER_TWEETS_FIELD_TOGGLES = SEARCH_FIELD_TOGGLES


def patch_twikit() -> None:
    gql.Endpoint.SEARCH_TIMELINE = gql.Endpoint.url('GcXk9vN_d1jUfHNqLacXQA/SearchTimeline')
    gql.Endpoint.USER_BY_SCREEN_NAME = gql.Endpoint.url('IGgvgiOx4QZndDHuD3x9TQ/UserByScreenName')
    gql.Endpoint.USER_TWEETS = gql.Endpoint.url('FOlovQsiHGDls3c0Q_HaSQ/UserTweets')


async def bootstrap_transaction(client: Client) -> None:
    headers = {
        'User-Agent': client._user_agent,
        'Accept-Language': f'{client.language},{client.language.split("-")[0]};q=0.9',
        'X-Twitter-Active-User': 'yes',
        'X-Twitter-Client-Language': client.language,
        'Referer': 'https://x.com/',
    }
    response = await client.http.request('GET', 'https://x.com', headers=headers)
    home_soup = BeautifulSoup(response.text, 'html.parser')
    ondemand_url = get_ondemand_file_url(home_soup)
    ondemand_response = await client.http.request('GET', ondemand_url, headers=headers)
    client._x_transaction = XClientTransaction(
        home_page_response=home_soup,
        ondemand_file_response=ondemand_response.text,
    )


async def patched_request(self, method: str, url: str, auto_unlock: bool = True, raise_exception: bool = True, **kwargs):
    headers = kwargs.pop('headers', {})

    if not hasattr(self, '_x_transaction'):
        await bootstrap_transaction(self)

    headers['X-Client-Transaction-Id'] = self._x_transaction.generate_transaction_id(method, urlparse(url).path)

    response = await self.http.request(method, url, headers=headers, **kwargs)
    self._remove_duplicate_ct0_cookie()

    try:
        data = response.json()
    except Exception:
        data = response.text

    if response.status_code >= 400 and raise_exception:
        raise Exception(f'status: {response.status_code}, url: {url}, body: {str(data)[:500]}')

    return data, response


def create_client_from_cookie_dict(cookies: dict) -> Client:
    patch_twikit()
    client = Client('en-US')
    client.set_cookies(cookies, clear_cookies=True)
    client.request = MethodType(patched_request, client)
    return client


def create_client_from_cookie_file(path: str | Path) -> Client:
    patch_twikit()
    client = Client('en-US')
    client.load_cookies(str(path))
    client.request = MethodType(patched_request, client)
    return client


def user_from_raw(raw: dict) -> dict:
    legacy = raw.get('legacy', {})
    core = raw.get('core', {})
    avatar = raw.get('avatar', {})
    return {
        'id': raw.get('rest_id') or raw.get('id'),
        'created_at': core.get('created_at') or legacy.get('created_at'),
        'name': core.get('name') or legacy.get('name'),
        'screen_name': core.get('screen_name') or legacy.get('screen_name'),
        'description': legacy.get('description') or '',
        'followers_count': legacy.get('followers_count') or 0,
        'following_count': legacy.get('friends_count') or 0,
        'statuses_count': legacy.get('statuses_count') or 0,
        'profile_image_url': avatar.get('image_url') or legacy.get('profile_image_url'),
    }


def user_to_dict(user) -> dict:
    return {
        'id': getattr(user, 'id', None),
        'created_at': getattr(user, 'created_at', None),
        'name': getattr(user, 'name', None),
        'screen_name': getattr(user, 'screen_name', None),
        'description': getattr(user, 'description', None) or '',
        'followers_count': getattr(user, 'followers_count', 0) or 0,
        'following_count': getattr(user, 'following_count', 0) or 0,
        'statuses_count': getattr(user, 'statuses_count', 0) or 0,
        'profile_image_url': getattr(user, 'profile_image_url', None),
    }


async def get_user_by_screen_name(client: Client, screen_name: str) -> dict:
    variables = {'screen_name': screen_name}
    response, _ = await client.gql.gql_get(
        gql.Endpoint.USER_BY_SCREEN_NAME,
        variables,
        USER_BY_SCREEN_NAME_FEATURES,
        extra_params={'fieldToggles': USER_BY_SCREEN_NAME_FIELD_TOGGLES},
    )
    return user_from_raw(response['data']['user']['result'])


async def search_timeline_raw(client: Client, query: str, product: str, count: int = 20, cursor: str | None = None) -> dict:
    variables = {
        'rawQuery': query,
        'count': count,
        'querySource': 'typed_query',
        'product': product,
    }
    if cursor:
        variables['cursor'] = cursor

    response, _ = await client.gql.gql_get(
        gql.Endpoint.SEARCH_TIMELINE,
        variables,
        SEARCH_FEATURES,
        extra_params={'fieldToggles': SEARCH_FIELD_TOGGLES},
    )
    return response


async def search_tweets(client: Client, query: str, count: int = 20) -> list[dict]:
    results: list[dict] = []
    cursor = None
    pages = max(1, min(5, (count + 19) // 20))

    for _ in range(pages):
        response = await search_timeline_raw(client, query, 'Latest', 20, cursor)
        instructions = response['data']['search_by_raw_query']['search_timeline']['timeline']['instructions']
        entries = []
        next_cursor = None

        for instruction in instructions:
            entries.extend(instruction.get('entries', []))

        for entry in entries:
            entry_id = entry.get('entryId', '')
            content = entry.get('content', {})
            if entry_id.startswith('cursor-bottom'):
                next_cursor = content.get('value')

            item = content.get('itemContent')
            if not item:
                continue
            raw = item.get('tweet_results', {}).get('result')
            if not raw:
                continue
            legacy = raw.get('legacy')
            core = raw.get('core', {}).get('user_results', {}).get('result')
            if not legacy or not core:
                continue
            results.append({
                'id': raw.get('rest_id'),
                'created_at': legacy.get('created_at'),
                'text': legacy.get('full_text') or legacy.get('text') or '',
                'reply_count': legacy.get('reply_count') or 0,
                'retweet_count': legacy.get('retweet_count') or 0,
                'favorite_count': legacy.get('favorite_count') or 0,
                'view_count': raw.get('views', {}).get('count') or 0,
                'lang': legacy.get('lang'),
                'user': user_from_raw(core),
            })

        if not next_cursor:
            break
        cursor = next_cursor

    return results[:count]


async def search_users(client: Client, query: str, count: int = 20) -> list[dict]:
    results: list[dict] = []
    cursor = None
    pages = max(1, min(5, (count + 19) // 20))

    for _ in range(pages):
        response = await search_timeline_raw(client, query, 'People', 20, cursor)
        instructions = response['data']['search_by_raw_query']['search_timeline']['timeline']['instructions']
        entries = []
        next_cursor = None

        for instruction in instructions:
            entries.extend(instruction.get('entries', []))

        for entry in entries:
            entry_id = entry.get('entryId', '')
            content = entry.get('content', {})
            if entry_id.startswith('cursor-bottom'):
                next_cursor = content.get('value')

            item = content.get('itemContent')
            if not item:
                continue
            raw = item.get('user_results', {}).get('result')
            if not raw or raw.get('__typename') != 'User':
                continue
            results.append(user_from_raw(raw))

        if not next_cursor:
            break
        cursor = next_cursor

    return results[:count]


async def get_user_tweets(client: Client, user_id: str, count: int = 20) -> list[dict]:
    variables = {
        'userId': user_id,
        'count': count,
        'includePromotedContent': False,
        'withQuickPromoteEligibilityTweetFields': True,
        'withVoice': True,
        'withV2Timeline': True,
    }
    response, _ = await client.gql.gql_get(
        gql.Endpoint.USER_TWEETS,
        variables,
        USER_TWEETS_FEATURES,
        extra_params={'fieldToggles': USER_TWEETS_FIELD_TOGGLES},
    )
    instructions = response['data']['user']['result']['timeline']['timeline']['instructions']
    entries = []
    for instruction in instructions:
        entries.extend(instruction.get('entries', []))

    results: list[dict] = []
    for entry in entries:
        item = entry.get('content', {}).get('itemContent')
        if not item:
            continue
        raw = item.get('tweet_results', {}).get('result')
        if not raw:
            continue
        legacy = raw.get('legacy')
        user_raw = raw.get('core', {}).get('user_results', {}).get('result')
        if not legacy or not user_raw:
            continue
        results.append({
            'id': raw.get('rest_id'),
            'created_at': legacy.get('created_at'),
            'text': legacy.get('full_text') or legacy.get('text') or '',
            'reply_count': legacy.get('reply_count') or 0,
            'retweet_count': legacy.get('retweet_count') or 0,
            'favorite_count': legacy.get('favorite_count') or 0,
            'view_count': raw.get('views', {}).get('count') or 0,
            'lang': legacy.get('lang'),
            'user': user_from_raw(user_raw),
        })
    return results
