import asyncio
import json
import os
import traceback
from http.server import BaseHTTPRequestHandler

try:
    from python_bridge import create_client_from_cookie_dict, get_user_by_screen_name, get_user_tweets, search_tweets, search_users
    IMPORT_ERROR = None
except Exception as e:
    IMPORT_ERROR = traceback.format_exc()
    create_client_from_cookie_dict = None
    get_user_by_screen_name = None
    get_user_tweets = None
    search_tweets = None
    search_users = None


def get_client():
    raw = os.environ.get('TWIKIT_COOKIES_JSON')
    if not raw:
        raise RuntimeError('TWIKIT_COOKIES_JSON is not configured')
    cookies = json.loads(raw)
    return create_client_from_cookie_dict(cookies)


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
            has_cookies = bool(os.environ.get('TWIKIT_COOKIES_JSON'))
            send_json(self, 200, {'status': 'ok', 'has_cookies': has_cookies})

    def do_POST(self):
        if IMPORT_ERROR:
            send_json(self, 500, {'error': 'Import failed', 'details': IMPORT_ERROR})
            return

        try:
            length = int(self.headers.get('content-length', '0'))
            body = self.rfile.read(length) if length else b'{}'
            payload = json.loads(body.decode('utf-8'))
            client = get_client()

            action = payload.get('action')

            if action == 'user':
                result = asyncio.run(get_user_by_screen_name(client, payload['screen_name']))
            elif action == 'tweet-search':
                result = asyncio.run(search_tweets(client, payload['query'], int(payload.get('count', 20))))
            elif action == 'user-search':
                result = asyncio.run(search_users(client, payload['query'], int(payload.get('count', 20))))
            elif action == 'user-tweets':
                result = asyncio.run(get_user_tweets(client, payload['user_id'], int(payload.get('count', 20))))
            else:
                send_json(self, 404, {'error': 'Not found'})
                return

            send_json(self, 200, result)
        except Exception as e:
            send_json(self, 500, {'error': str(e), 'trace': traceback.format_exc()})
