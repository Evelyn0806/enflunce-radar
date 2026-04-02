import asyncio
import json
import os
import traceback
from http.server import BaseHTTPRequestHandler

try:
    from python_bridge import create_client_from_cookie_dict, get_user_by_screen_name, get_user_tweets, get_user_following, search_tweets, search_users
    IMPORT_ERROR = None
except Exception as e:
    IMPORT_ERROR = traceback.format_exc()
    create_client_from_cookie_dict = None
    get_user_by_screen_name = None
    get_user_tweets = None
    search_tweets = None
    search_users = None


def load_cookie_pools():
    """Load multiple cookie sets for rotation. Supports:
    - TWIKIT_COOKIES_JSON: primary account
    - TWIKIT_COOKIES_JSON_2: secondary account
    - TWIKIT_COOKIES_JSON_3: tertiary account (optional)
    """
    pools = []
    for key in ['TWIKIT_COOKIES_JSON', 'TWIKIT_COOKIES_JSON_2', 'TWIKIT_COOKIES_JSON_3']:
        raw = os.environ.get(key)
        if raw:
            try:
                pools.append(json.loads(raw))
            except json.JSONDecodeError:
                pass
    return pools


# Track which cookie index to use next (round-robin)
_cookie_index = 0


def get_client():
    global _cookie_index
    pools = load_cookie_pools()
    if not pools:
        raise RuntimeError('No TWIKIT_COOKIES_JSON configured')
    cookies = pools[_cookie_index % len(pools)]
    return create_client_from_cookie_dict(cookies)


def rotate_client():
    """Switch to next cookie on rate limit."""
    global _cookie_index
    _cookie_index += 1


def run_with_rotation(coro_fn, *args, max_retries=None):
    """Try the request, on 429 rotate to next cookie and retry."""
    pools = load_cookie_pools()
    retries = max_retries or len(pools)

    for attempt in range(retries):
        client = get_client()
        try:
            return asyncio.run(coro_fn(client, *args))
        except Exception as e:
            error_str = str(e).lower()
            if '429' in error_str or 'rate limit' in error_str:
                if attempt < retries - 1:
                    rotate_client()
                    continue
            raise
    raise RuntimeError('All cookie accounts rate limited')


def send_json(handler, status, data):
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json')
    handler.end_headers()
    handler.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if IMPORT_ERROR:
            send_json(self, 500, {'error': 'Import failed', 'details': IMPORT_ERROR})
        else:
            pools = load_cookie_pools()
            send_json(self, 200, {
                'status': 'ok',
                'accounts': len(pools),
                'active_index': _cookie_index % max(len(pools), 1),
            })

    def do_POST(self):
        if IMPORT_ERROR:
            send_json(self, 500, {'error': 'Import failed', 'details': IMPORT_ERROR})
            return

        try:
            length = int(self.headers.get('content-length', '0'))
            body = self.rfile.read(length) if length else b'{}'
            payload = json.loads(body.decode('utf-8'))

            action = payload.get('action')

            if action == 'user':
                result = run_with_rotation(get_user_by_screen_name, payload['screen_name'])
            elif action == 'tweet-search':
                result = run_with_rotation(search_tweets, payload['query'], int(payload.get('count', 20)))
            elif action == 'user-search':
                result = run_with_rotation(search_users, payload['query'], int(payload.get('count', 20)))
            elif action == 'user-tweets':
                result = run_with_rotation(get_user_tweets, payload['user_id'], int(payload.get('count', 20)))
            elif action == 'user-following':
                result = run_with_rotation(get_user_following, payload['user_id'], int(payload.get('count', 50)))
            else:
                send_json(self, 404, {'error': 'Not found'})
                return

            send_json(self, 200, result)
        except Exception as e:
            send_json(self, 500, {'error': str(e), 'trace': traceback.format_exc()})
