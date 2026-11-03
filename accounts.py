import sqlite3, hashlib, secrets, time, json, re
from pathlib import Path
from http.cookies import SimpleCookie

DATA = Path(__file__).parent / 'data'
DATA.mkdir(exist_ok=True)
DB = DATA / 'transpage.sqlite3'
def connect():
    db = sqlite3.connect(DB, timeout=15)
    db.row_factory = sqlite3.Row
    return db
with connect() as db:
    db.executescript('''
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, plan TEXT NOT NULL, amount_minor INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL, provider_transaction TEXT UNIQUE, created_at INTEGER NOT NULL, paid_at INTEGER);
    CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY, failures INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    ''')
def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def password_hash(password, salt): return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
def current_user(handler):
    cookie = SimpleCookie()
    try: cookie.load(handler.headers.get('Cookie', ''))
    except Exception: return None
    token = cookie.get('transpage_session')
    if not token: return None
    with connect() as db:
        row = db.execute('SELECT u.id,u.email,u.created_at FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?', (digest(token.value), int(time.time()))).fetchone()
    return dict(row) if row else None
def reply(handler, value, status=200, cookie=None):
    body = json.dumps(value).encode()
    handler.send_response(status)
    handler.send_header('Content-Type','application/json; charset=utf-8')
    handler.send_header('Cache-Control','no-store')
    if cookie: handler.send_header('Set-Cookie', cookie)
    handler.end_headers(); handler.wfile.write(body)
def get(handler):
    user = current_user(handler)
    if handler.path == '/api/me': reply(handler, {'user': user}); return
    if not user: reply(handler, {'error':'请先登录 / Please sign in'},401); return
    with connect() as db:
        orders = [dict(r) for r in db.execute('SELECT id,plan,amount_minor,currency,status,created_at,paid_at FROM orders WHERE user_id=? ORDER BY created_at DESC',(user['id'],))]
    reply(handler, {'orders': orders})
def post(handler):
    try:
        if handler.headers.get('Sec-Fetch-Site') == 'cross-site': raise ValueError('请求来源无效 / Invalid request origin')
        origin = handler.headers.get('Origin')
        if origin and origin not in ('http://' + handler.headers.get('Host',''), 'https://' + handler.headers.get('Host','')): raise ValueError('请求来源无效 / Invalid request origin')
        size = int(handler.headers.get('Content-Length','0'))
        if size<0 or size>4096: raise ValueError('请求过大 / Request too large')
        data = json.loads(handler.rfile.read(size) or b'{}')
        if not isinstance(data,dict): raise ValueError('无效请求 / Invalid request')
        if handler.path == '/api/logout':
            cookie = SimpleCookie(); cookie.load(handler.headers.get('Cookie',''))
            if cookie.get('transpage_session'):
                with connect() as db: db.execute('DELETE FROM sessions WHERE token_hash=?',(digest(cookie['transpage_session'].value),))
            reply(handler, {'ok':True}, cookie='transpage_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'); return
        email = str(data.get('email','')).strip().lower(); password = str(data.get('password',''))
        if len(email)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email): raise ValueError('请输入有效邮箱 / Enter a valid email')
        if not 10<=len(password)<=128: raise ValueError('密码需为10–128个字符 / Password must contain 10–128 characters')
        now = int(time.time()); key = digest(handler.client_address[0])
        with connect() as db:
            attempt=db.execute('SELECT * FROM login_attempts WHERE key=?',(key,)).fetchone()
            if attempt and attempt['reset_at']>now and attempt['failures']>=10:
                reply(handler, {'error':'尝试过多，请15分钟后重试 / Too many attempts; retry in 15 minutes'},429); return
            db.execute('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN reset_at<=? THEN 1 ELSE failures+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END',(key,now+900,now,now,now+900))
        with connect() as db:
            if handler.path == '/api/register':
                salt=secrets.token_hex(16)
                try: db.execute('INSERT INTO users(email,salt,password_hash,created_at) VALUES(?,?,?,?)',(email,salt,password_hash(password,salt),now))
                except sqlite3.IntegrityError: raise ValueError('无法注册该邮箱，请尝试登录 / Unable to register; try signing in')
            user=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
            check=password_hash(password, user['salt'] if user else '00'*16)
            if not user or not secrets.compare_digest(check,user['password_hash']): raise ValueError('邮箱或密码错误 / Incorrect email or password')
            token=secrets.token_urlsafe(32)
            db.execute('DELETE FROM sessions WHERE expires_at<=?',(now,))
            db.execute('INSERT INTO sessions VALUES(?,?,?)',(digest(token),user['id'],now+604800))
        reply(handler, {'ok':True}, cookie='transpage_session='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800')
    except (ValueError,TypeError):
        import sys
        error=sys.exc_info()[1]
        reply(handler, {'error':str(error)},400)
