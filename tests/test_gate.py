import sys
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: fails.append(m)
CFG="export const GUMROAD_PRODUCT_ID='abc';export const GUMROAD_URL='https://pocketappstudio.gumroad.com';export const APP_NAME='Restock';export const APP_VERSION='1.0.0';"
with sync_playwright() as p:
    b=p.chromium.launch()
    for mode in ['bad','ok','down']:
        c=b.new_context(service_workers='block'); pg=c.new_page()
        pg.route('**/config.js',lambda r:r.fulfill(body=CFG,content_type='text/javascript'))
        def mk(mode):
          def api(r):
              if mode=='down': r.abort()
              else: r.fulfill(status=200 if mode=='ok' else 404,content_type='application/json',headers={'access-control-allow-origin':'*'},body='{"success":%s}'%('true' if mode=='ok' else 'false'))
          return api
        pg.route('https://api.gumroad.com/**',mk(mode))
        pg.goto('http://localhost:8765/'); pg.wait_for_selector('#lic'); pg.fill('#lic','KEY-1'); pg.click('#licgo')
        if mode=='bad':
            pg.wait_for_selector('.err'); ok(True,'bad key shows error, stays gated')
        else:
            pg.wait_for_selector('.tiles'); ok(True,f'{mode}: app opens')
            pg.reload(); pg.wait_for_selector('.tiles'); ok(True,f'{mode}: no re-check, stays open')
        c.close()
    # no product id: no gate
    c=b.new_context(); pg=c.new_page(); pg.goto('http://localhost:8765/'); pg.wait_for_selector('.tiles'); ok(pg.locator('#lic').count()==0,'empty product id = fully open')
print(fails); sys.exit(1 if fails else 0)
