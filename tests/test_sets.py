# Set editor: add items via + and via Enter/Go, then leave and reopen; items must persist (also after reload).
import sys
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'; fails=[]
def ok(c,m):
    print(('PASS ' if c else 'FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
  for eng in ['chromium','webkit']:
    try: b=getattr(p,eng).launch()
    except Exception as e: print('SKIP',eng,e.__class__.__name__); continue
    ctx=b.new_context(viewport={'width':390,'height':844},has_touch=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(BASE+'#/sets'); pg.wait_for_selector('[data-newset]')
    pg.locator('[data-newset]').tap(); pg.wait_for_selector('#sadd'); pg.wait_for_timeout(400)
    sid=pg.evaluate("location.hash")
    chips=lambda:pg.locator('#schips .chip').all_inner_texts()
    pg.locator('#sadd').tap(); pg.keyboard.type('Butter'); pg.locator('#saddb').tap(); pg.wait_for_timeout(200)
    ok(len(chips())==1 and pg.locator('#sadd').input_value()=='', f'{eng}: + tap adds item and clears field')
    pg.locator('#sadd').click(); pg.keyboard.type('Flour'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    ok(len(chips())==2, f'{eng}: Enter/Go adds item')
    ok(pg.evaluate("location.hash")==sid, f'{eng}: Enter does not navigate away')
    pg.locator('#sadd').click(); pg.keyboard.type('Sugar, eggs'); pg.locator('#saddb').click(); pg.wait_for_timeout(200)
    ok(len(chips())==4, f'{eng}: + with mouse adds comma list')
    pg.locator('#sadd').fill('Vanilla')
    pg.locator('[data-back]').tap(); pg.wait_for_timeout(500)   # typed but not added: kept on leave
    pg.goto(BASE+sid); pg.wait_for_timeout(300); pg.reload(); pg.wait_for_selector('#schips'); pg.wait_for_timeout(500)
    names=[t.strip() for t in chips()]
    ok(len(names)==5 and any('Vanilla' in n for n in names), f'{eng}: reopened set keeps all 5 items {names}')
    ok(not errs, f'{eng}: no page errors {errs}')
    b.close()
sys.exit(1 if fails else 0)
