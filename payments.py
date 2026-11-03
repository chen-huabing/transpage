import os,json,uuid,base64,urllib.request,urllib.error
from decimal import Decimal

PLANS=[(249,50000),(649,150000),(1999,500000)]
def request(url,headers,data=None,method=None):
    req=urllib.request.Request(url,headers=headers,data=json.dumps(data).encode() if data is not None else None,method=method)
    with urllib.request.urlopen(req,timeout=30) as r:
        body=r.read()
        return json.loads(body) if body else None
def sb(path,data=None,method=None,token=None):
    key=os.environ['SUPABASE_SECRET_KEY'].strip().strip('"').strip("'")
    headers={'apikey':key,'Content-Type':'application/json','Prefer':'return=representation'}
    if token:headers['Authorization']='Bearer '+token
    elif key.startswith('eyJ'):headers['Authorization']='Bearer '+key
    return request(os.environ['SUPABASE_URL'].rstrip('/')+path,headers,data,method)
def pp(path,data=None,request_id=None):
    if os.environ.get('PAYPAL_ENV')!='sandbox':raise ValueError('Live payments disabled')
    auth=base64.b64encode((os.environ['PAYPAL_CLIENT_ID']+':'+os.environ['PAYPAL_CLIENT_SECRET']).encode()).decode()
    req=urllib.request.Request('https://api-m.sandbox.paypal.com/v1/oauth2/token',data=b'grant_type=client_credentials',headers={'Authorization':'Basic '+auth})
    with urllib.request.urlopen(req,timeout=30) as r:token=json.load(r)['access_token']
    headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
    if request_id:headers['PayPal-Request-Id']=request_id
    return request('https://api-m.sandbox.paypal.com'+path,headers,data)
def fulfill(order,payment):
    unit=payment['purchase_units'][0];captures=unit.get('payments',{}).get('captures',[])
    if payment['status']!='COMPLETED' or len(captures)!=1 or captures[0]['status']!='COMPLETED' or unit.get('custom_id')!=order['id']:raise ValueError('Payment not completed')
    capture=captures[0];amount=capture['amount']
    if Decimal(amount['value'])*100!=order['amount_minor'] or amount['currency_code']!=order['currency']:raise ValueError('Amount mismatch')
    sb('/rest/v1/rpc/fulfill_paypal_order',{'p_order_id':order['id'],'p_paypal_order_id':order['paypal_order_id'],'p_capture_id':capture['id'],'p_amount_minor':order['amount_minor'],'p_currency':order['currency']})

def handle(h):
    try:
        if os.environ.get('PAYPAL_ENV')!='sandbox':raise ValueError('Live payments disabled')
        if h.headers.get('Sec-Fetch-Site')=='cross-site':raise ValueError('Invalid origin')
        size=int(h.headers.get('Content-Length','0'))
        if not 0<size<=4096:raise ValueError('Invalid request size')
        body=json.loads(h.rfile.read(size))
        auth=h.headers.get('Authorization','')
        if not auth.startswith('Bearer '):return reply(h,{'error':'Please sign in / 请先登录'},401)
        user=sb('/auth/v1/user',token=auth[7:])
        if not user.get('id'):raise ValueError('Please sign in')
        if h.path=='/api/paypal/sync':
            rows=sb('/rest/v1/orders?user_id=eq.'+user['id']+'&status=eq.pending&environment=eq.sandbox&paypal_order_id=not.is.null&order=created_at.desc&limit=20')
            updated=0
            for order in rows:
                payment=pp('/v2/checkout/orders/'+order['paypal_order_id'])
                if payment['status']=='COMPLETED':
                    fulfill(order,payment);updated+=1
            return reply(h,{'ok':True,'updated':updated})
        if h.path=='/api/paypal/create':
            plan=body.get('plan')
            if type(plan)!=int or plan not in range(3):raise ValueError('Invalid plan')
            amount,credits=PLANS[plan];order_id=str(uuid.uuid4())
            sb('/rest/v1/orders',{'id':order_id,'user_id':user['id'],'plan':str(plan),'amount_minor':amount,'currency':'USD','status':'pending','credits':credits,'environment':'sandbox'})
            payment=pp('/v2/checkout/orders',{'intent':'CAPTURE','purchase_units':[{'custom_id':order_id,'amount':{'currency_code':'USD','value':f'{amount/100:.2f}'}}]},order_id)
            sb('/rest/v1/orders?id=eq.'+order_id,{'paypal_order_id':payment['id']},'PATCH')
            return reply(h,{'id':payment['id']})
        payment_id=str(body.get('orderID',''))
        if not payment_id.isalnum() or len(payment_id)>64:raise ValueError('Invalid order')
        rows=sb('/rest/v1/orders?paypal_order_id=eq.'+payment_id+'&user_id=eq.'+user['id'])
        if len(rows)!=1:raise ValueError('Order not found')
        order=rows[0]
        if order['environment']!='sandbox':raise ValueError('Environment mismatch')
        payment=pp('/v2/checkout/orders/'+payment_id)
        if payment['status']!='COMPLETED':
            pp('/v2/checkout/orders/'+payment_id+'/capture',{},order['id'])
            # Capture defaults to a minimal response; retrieve full order details.
            payment=pp('/v2/checkout/orders/'+payment_id)
        unit=payment['purchase_units'][0];captures=unit.get('payments',{}).get('captures',[])
        if payment['status']!='COMPLETED' or len(captures)!=1 or captures[0]['status']!='COMPLETED' or unit.get('custom_id')!=order['id']:raise ValueError('Payment not completed')
        capture=captures[0];amount=capture['amount']
        if Decimal(amount['value'])*100!=order['amount_minor'] or amount['currency_code']!=order['currency']:raise ValueError('Amount mismatch')
        sb('/rest/v1/rpc/fulfill_paypal_order',{'p_order_id':order['id'],'p_paypal_order_id':payment_id,'p_capture_id':capture['id'],'p_amount_minor':order['amount_minor'],'p_currency':order['currency']})
        reply(h,{'ok':True,'credits':order['credits'],'environment':'sandbox'})
    except urllib.error.HTTPError as e:
        reply(h,{'error':'Payment service error / 支付服务请求失败 ('+str(e.code)+'). Retry confirmation if payment was approved.'},502)
    except Exception as e:reply(h,{'error':str(e) if isinstance(e,ValueError) else 'Payment unavailable / 支付暂不可用'},400)
def reply(h,value,status=200):
    h.send_response(status);h.send_header('Content-Type','application/json');h.send_header('Cache-Control','no-store');h.end_headers();h.wfile.write(json.dumps(value).encode())
