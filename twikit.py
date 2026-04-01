import asyncio
import json
import os
from http.server import BaseHTTPRequestHandler

from python_bridge import create_client_from_cookie_dict, get_user_by_screen_name, get_user_tweets, search_tweets, search_users


def get_client():
    raw = os.environ.get('TWIKIT_COOKIES_JSON')
    if not raw:
        raise RuntimeError('TWIKIT_COOKIES_JSON is not configured')
    cookies = json.loads(raw)
    return create_client_from_cookie_dict(cookies)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
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
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))
                return

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))
