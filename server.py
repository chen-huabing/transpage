import json, os, urllib.request, urllib.error, secrets
import accounts
import payments
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = Path(__file__).parent
env = ROOT / '.env'
if env.exists():
    for line in env.read_text().splitlines():
        if '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k, v)
KEY = os.environ.get('DEEPL_API_KEY', '')
BASE = 'https://api-free.deepl.com' if KEY.endswith(':fx') else 'https://api.deepl.com'
jobs = {}

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/paypal/config':
            return payments.reply(self, {'enabled': os.environ.get('PAYPAL_ENV')=='sandbox', 'clientId':os.environ.get('PAYPAL_CLIENT_ID',''), 'environment':'sandbox'})
        if self.path in ('/api/me', '/api/orders'):
            return accounts.get(self)
        if self.path != '/api/languages':
            return super().do_GET()
        try:
            result = {}
            for kind in ('source', 'target'):
                req = urllib.request.Request(BASE + '/v2/languages?type=' + kind, headers={'Authorization': 'DeepL-Auth-Key ' + KEY})
                with urllib.request.urlopen(req, timeout=20) as response:
                    result[kind] = json.load(response)
            body = json.dumps(result).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers(); self.wfile.write(body)
        except Exception:
            self.reply_error('语言列表加载失败，请稍后刷新重试')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def do_POST(self):
        if self.path in ('/api/paypal/create','/api/paypal/capture','/api/paypal/sync'):
            return payments.handle(self)
        if self.path in ('/api/register', '/api/login', '/api/logout'):
            return accounts.post(self)
        try:
            if self.headers.get('Sec-Fetch-Site') == 'cross-site':
                self.send_error(403); return
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 11 * 1024 * 1024:
                self.send_error(413); return
            data = self.rfile.read(length)
            if not KEY:
                raise ValueError('服务端尚未配置 DEEPL_API_KEY')
            action = self.path.removeprefix('/api/')
            if action == 'upload':
                path = '/v2/document'
                content_type = self.headers.get('Content-Type', '')
                if not content_type.startswith('multipart/form-data;'):
                    raise ValueError('无效上传格式')
            elif action in ('status', 'result'):
                token = json.loads(data).get('token')
                if token not in jobs:
                    raise ValueError('翻译任务不存在，请重新上传')
                doc = jobs[token]
                path = '/v2/document/' + doc['document_id'] + ('/result' if action == 'result' else '')
                data = json.dumps({'document_key': doc['document_key']}).encode()
                content_type = 'application/json'
            else:
                self.send_error(404); return
            req = urllib.request.Request(BASE + path, data=data, headers={'Authorization': 'DeepL-Auth-Key ' + KEY, 'Content-Type': content_type})
            with urllib.request.urlopen(req, timeout=180) as response:
                body = response.read()
                mime = response.headers.get('Content-Type', 'application/octet-stream')
            if action == 'upload':
                token = secrets.token_urlsafe(32)
                jobs[token] = json.loads(body)
                body = json.dumps({'token': token}).encode()
                mime = 'application/json'
            if action == 'result':
                jobs.pop(token, None)
            self.send_response(200)
            self.send_header('Content-Type', mime)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers(); self.wfile.write(body)
        except urllib.error.HTTPError as e:
            self.reply_error('DeepL 请求失败（%s）：%s' % (e.code, {403:'密钥无效或权限不足', 456:'翻译额度不足', 413:'文件超出套餐限制', 429:'请求过于频繁'}.get(e.code, '请检查文件与套餐限制')))
        except Exception as e:
            self.reply_error(str(e) if isinstance(e, ValueError) else '连接 DeepL 失败，请稍后重试')

    def reply_error(self, message):
        body = message.encode('utf-8')
        self.send_response(400); self.send_header('Content-Type', 'text/plain; charset=utf-8'); self.end_headers(); self.wfile.write(body)

if __name__ == '__main__':
    print('Document translator: http://127.0.0.1:8765', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8765), Handler).serve_forever()
