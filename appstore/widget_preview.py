# Approval previews of the iOS widget (HTML mock of the SwiftUI layout, same palette and sizes).
from playwright.sync_api import sync_playwright
P={'light':dict(bg='#FAF7F0',sf='#FFFFFF',tx='#17140F',mu='#4B4437',ac='#0A5B38',on='#FFFFFF'),
   'dark':dict(bg='#11140F',sf='#1B201A',tx='#F5F2E9',mu='#CFCABB',ac='#8EE6AE',on='#07150C')}
need=['Milk','Eggs','Bananas','Coffee']; soon=[('Bread',3),('Yogurt',5),('Paper towels',9)]
dw=lambda d:'today' if d<=0 else ('1 day' if d==1 else f'{d} days')
def tile(big,w): return f'<div class=tile style="width:{w}px"><div class=band>OCT</div><div class=dn style="font-size:{big}px">19</div></div>'
def count(n,size): return f'<div><div class=h>TO BUY</div><div class=cnt style="font-size:{size}px">{n}</div><div class=cap>items</div></div>'
nr=lambda n:f'<div class=r><span class=o>○</span><b>{n}</b></div>'
sr=lambda n,d:f'<div class=r><span class=m>↻</span><b>{n}</b><span class=sp></span><span class=d>{dw(d)}</span></div>'
W={'small':(170,170,lambda:tile(24,56)+'<div style="height:6px"></div>'+count(4,40)),
   'medium':(364,170,lambda:f'<div style="display:flex;gap:14px"><div style="width:92px">{tile(28,60)}<div style="height:6px"></div>{count(4,40)}</div><div style="flex:1;display:flex;flex-direction:column;gap:4px"><div class=h>NEED NOW</div>{"".join(nr(n) for n in need[:3])}<div style="flex:1"></div><div class=h>COMING DUE</div>{sr(*soon[0])}</div></div>'),
   'large':(364,382,lambda:f'<div style="display:flex;gap:14px;align-items:flex-start">{tile(34,70)}{count(4,50)}<span class=sp></span><span class=wd>Monday</span></div><div class=h style="margin-top:8px">NEED NOW</div>{"".join(nr(n) for n in need)}<div class=h style="margin-top:6px">COMING DUE</div>{"".join(sr(*s) for s in soon)}')}
css=lambda c:f'''body{{margin:0;background:#888;font-family:-apple-system,"SF Pro Text",Inter,system-ui,sans-serif}}
.w{{background:{c["bg"]};border-radius:22px;padding:16px;box-sizing:border-box;margin:20px;overflow:hidden;color:{c["tx"]}}}
.tile{{background:{c["sf"]};border-radius:10px;overflow:hidden;text-align:center}}.band{{background:{c["ac"]};color:{c["on"]};font:800 13px sans-serif;letter-spacing:1px;padding:3px 0}}
.dn{{font-weight:700}}.h{{font:800 12px sans-serif;letter-spacing:1px;color:{c["mu"]}}}.cnt{{font-weight:700;color:{c["ac"]};line-height:1.05}}.cap{{font:600 15px sans-serif;color:{c["mu"]}}}
.r{{display:flex;gap:6px;align-items:center;font-size:16px;margin:2px 0}}.o{{color:{c["tx"]};font-weight:700}}.m{{color:{c["mu"]};font-weight:700}}.sp{{flex:1}}.d{{font-weight:800}}.wd{{font-weight:700;color:{c["mu"]}}}
.lock{{background:#222;color:#fff;margin:20px;padding:14px;border-radius:18px;display:flex;gap:16px;align-items:center;width:max-content}}.circ{{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;font-size:24px}}.rect{{width:160px}}'''
with sync_playwright() as p:
  b=p.chromium.launch(); pg=b.new_page(device_scale_factor=3)
  for th,c in P.items():
    for k,(w,h,f) in W.items():
      pg.set_content(f'<style>{css(c)}</style><div class=w id=x style="width:{w}px;height:{h}px">{f()}</div>'); pg.locator('#x').screenshot(path=f'widget-{k}-{th}.png')
  pg.set_content(f'<style>{css(P["dark"])}</style><div class=lock id=x><div class=circ><span style="font-size:11px">🛒</span>4</div><div class=rect><b style="font-size:17px">4 to buy</b><br><span style="font-size:16px">Bread · 3 days</span></div></div>'); pg.locator('#x').screenshot(path='widget-lockscreen.png')
  b.close()
