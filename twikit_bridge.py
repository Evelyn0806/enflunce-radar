import asyncio
import json
import sys
from pathlib import Path

from twikit.errors import UserNotFound

from python_bridge import create_client_from_cookie_file, get_user_by_screen_name, get_user_tweets, search_tweets

PROJECT_ROOT = Path(__file__).resolve().parents[1]
COOKIES_FILE = Path(
    sys.argv[sys.argv.index('--cookies') + 1]
    if '--cookies' in sys.argv
    else PROJECT_ROOT / '.twikit.cookies.json'
)


async def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit('usage: twikit_bridge.py <command> [args]')

    command = sys.argv[1]
    client = create_client_from_cookie_file(COOKIES_FILE)

    try:
        if command == 'user':
            screen_name = sys.argv[2].lstrip('@')
            print(json.dumps(await get_user_by_screen_name(client, screen_name), ensure_ascii=False))
            return

        if command == 'tweet-search':
            query = sys.argv[2]
            count = int(sys.argv[3]) if len(sys.argv) > 3 else 20
            print(json.dumps(await search_tweets(client, query, count), ensure_ascii=False))
            return

        if command == 'user-tweets':
            user_id = sys.argv[2]
            count = int(sys.argv[3]) if len(sys.argv) > 3 else 20
            print(json.dumps(await get_user_tweets(client, user_id, count), ensure_ascii=False))
            return

        raise SystemExit(f'unknown command: {command}')
    except UserNotFound:
        print(json.dumps({'error': 'User not found'}))
        raise SystemExit(1)


if __name__ == '__main__':
    asyncio.run(main())
