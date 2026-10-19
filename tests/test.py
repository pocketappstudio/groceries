import json, sys, re, os, datetime
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'
fails=[]
def ok(c,msg):
    print(('PASS ' if c else 'FAIL ')+msg)
    if not c: fails.append(msg)
def at(ctx,d):
    ctx.clock.set_fixed_time(datetime.datetime.fromisoformat(d+'T12:00:00'))
IPHONE=dict(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
with sync_playwright() as p:
    b=p.chromium.launch()
    # ---- A. pure logic
    ctx=b.new_context(**IPHONE); pg=ctx.new_page(); pg.goto(BASE); pg.wait_for_selector('.tiles')
    r=pg.evaluate("""async()=>{const L=await import('./logic.js');const o={};
      o.weekly=L.pattern(['2026-01-01','2026-01-08','2026-01-15','2026-01-22']);
      o.monwed=L.pattern(['2026-01-05','2026-01-07','2026-01-12','2026-01-14','2026-01-19','2026-01-21']);
      o.irregular=L.pattern(['2026-01-01','2026-01-08','2026-03-15']);
      o.two=L.pattern(['2026-01-01','2026-01-08']);
      o.keys=[L.keyOf('Eggs'),L.keyOf('egg'),L.keyOf('Tomatoes'),L.keyOf('berries'),L.keyOf('Bus')];
      o.parse=L.parseEntry('add milk, 2 eggs and bread. some apples');
      o.thx=[L.HOLIDAYS.find(h=>h.key=='thanksgiving').date(2025),L.HOLIDAYS.find(h=>h.key=='thanksgiving').date(2026)];
      // thanksgiving offer
      let S=L.emptyState();
      for(const n of ['Turkey','Cranberries','Green beans']) {S.history.push({k:L.keyOf(n),n,d:'2025-11-24'}); L.ensureItem(S,n);}
      for(const d of ['2025-11-03','2025-11-10','2025-11-17','2025-11-24']) S.history.push({k:'milk',n:'Milk',d});
      L.ensureItem(S,'Milk'); for(const it of S.items) L.recompute(S,it);
      o.milkRec=L.findKey(S,'milk').recurring;
      o.offer=L.offers(S,'2026-11-15').map(x=>[x.id,x.title,x.items.map(i=>i.name).sort()]);
      o.noOfferFar=L.offers(S,'2026-09-01').length;
      // user set returns
      let T=L.emptyState(); L.addSet(T,'Thanksgiving casserole',['Green beans','Fried onions','Soup'],'thanksgiving');
      o.setOffer=L.offers(T,'2026-11-20').map(x=>[x.kind,x.title,x.items.length]);
      // check-off flow -> auto add
      let U=L.emptyState(); const m=L.addNames(U,['Milk'])[0];
      for(const d of ['2026-10-01','2026-10-08','2026-10-15']){L.addNames(U,['Milk']);L.checkOff(U,m.id,d);}
      o.rec=[m.recurring,m.interval]; o.added0=L.refreshDue(U,'2026-10-18').length; o.added1=L.refreshDue(U,'2026-10-20').map(i=>i.name); o.di=L.dueInfo(U,m,'2026-10-20');
      // snooze
      L.removeFromList(U,m.id,'2026-10-20'); o.snoozed=L.refreshDue(U,'2026-10-21').length; o.afterSnooze=L.refreshDue(U,'2026-10-24').length;
      // csv/json roundtrip
      let V=L.emptyState(); L.addNames(V,['Milk, whole','Say "hi" cheese']); V.history.push({k:'milk whole',n:'Milk, whole',d:'2026-01-02'}); L.addSet(V,'Taco, night',['Tortillas','Salsa'],'july4');
      const csv=L.toCSV(V); const back=L.parseImport(csv); const json=L.parseImport(L.toJSON(V,'2026-10-18'));
      o.csv=[back.items.map(i=>i.name).sort(),back.history.length,back.sets[0].items,back.sets[0].occasion,back.items.filter(i=>i.onList).length];
      o.json=[json.items.length,json.history.length,json.sets.length];
      let W=L.emptyState(); const n1=L.merge(W,back); const n2=L.merge(W,back); o.merge=[n1,n2];
      o.simple=L.parseImport('date,item\\n2026-01-01,Milk\\n2026-01-08,Milk\\n2026-01-15,Milk\\n').items[0].recurring;
      o.plain=L.parseImport('Bread\\nEggs\\n').items.map(i=>i.onList);
      return o;}""")
    print(json.dumps(r))
    ok(r['weekly']['interval']==7,'weekly interval 7')
    ok(r['monwed'] is not None and r['monwed']['interval'] in (2,3,4),'Mon/Wed pattern detected %s'%r['monwed'])
    ok(r['irregular'] is None and r['two'] is None,'irregular / too few not locked')
    ok(r['keys']==['egg','egg','tomato','berry','bus'],'keys normalise %s'%r['keys'])
    ok(r['parse']==['Milk','2 eggs','Bread','Apples'],'parseEntry %s'%r['parse'])
    ok(r['thx']==['2025-11-27','2026-11-26'],'thanksgiving dates')
    ok(r['milkRec'] is True,'milk recurring from 4 weekly')
    ok(len(r['offer'])==1 and r['offer'][0][1]=='Thanksgiving' and r['offer'][0][2]==['Cranberries','Green beans','Turkey'],'thanksgiving offer excludes recurring milk %s'%r['offer'])
    ok(r['noOfferFar']==0,'no offers far from holiday')
    ok(r['setOffer']==[['set','Thanksgiving casserole',3]],'user set returns near holiday')
    ok(r['rec']==[True,7],'3 weekly check-offs lock recurring 7d')
    ok(r['added0']==0 and r['added1']==['Milk'],'auto-add only when within lead (due 10-22, lead 2)')
    ok(r['di']['days']==2,'due in 2 days')
    ok(r['snoozed']==0 and r['afterSnooze']==1,'remove from list snoozes then returns')
    ok(r['csv']==[['Milk, whole','Say "hi" cheese'],1,['Tortillas','Salsa'],'july4',2],'csv roundtrip %s'%r['csv'])
    ok(r['json']==[2,1,1],'json roundtrip')
    ok(r['merge'][0]>0 and r['merge'][1]==0,'merge idempotent %s'%r['merge'])
    ok(r['simple'] is True and r['plain']==[True,True],'simple csv imports')
    ctx.close()

    # ---- B. UI flow with time travel
    ctx=b.new_context(accept_downloads=True,**IPHONE); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:m.type=='error' and errs.append(m.text))
    at(ctx,'2026-10-01'); pg.goto(BASE); pg.wait_for_selector('.tiles')
    pg.screenshot(path='tests/shots/home-empty.png')
    def add(names):
        pg.click(".fab"); pg.fill('#in',names); pg.click('#ok'); pg.wait_for_selector('.row,.empty'); pg.wait_for_timeout(450)
    add('Milk, eggs and bread')
    ok(pg.locator('.row .nm').all_inner_texts()==['Bread','Eggs','Milk'],'dictated string splits into 3 items')
    pg.screenshot(path='tests/shots/home-list.png')
    def buy(name):
        pg.locator('.row',has_text=name).locator('.check').click(); pg.wait_for_timeout(700)
    buy('Milk'); ok(pg.locator('.row',has_text='Milk').count()==0,'check-off removes from list')
    for d in ['2026-10-08','2026-10-15']:
        at(ctx,d); pg.reload(); pg.wait_for_selector('.tiles'); add('milk'); buy('Milk')
    t=pg.inner_text('#toast'); ok('every 7 days' in t,'toast announces recurring: '+t.replace('\n',' '))
    at(ctx,'2026-10-20'); pg.reload(); pg.wait_for_selector('.tiles')
    ok(pg.locator('.row',has_text='Milk').count()==1 and 'Due in 2 days' in pg.inner_text('.row:has-text("Milk")'),'milk auto-added with due tag')
    pg.screenshot(path='tests/shots/home-due.png')
    buy('Milk'); pg.reload(); pg.wait_for_selector('.tiles')
    ok(pg.locator('h2',has_text='Coming due').count()==1,'coming due section')
    pg.screenshot(path='tests/shots/home-coming.png')
    # persistence across reload
    pg.reload(); pg.wait_for_selector('.tiles'); ok(pg.locator('.row .nm').count()>=2,'state persists')
    # item screen
    pg.locator('.rowmain').first.click(); pg.wait_for_selector('.stepper,.kv'); pg.screenshot(path='tests/shots/item.png')
    pg.go_back(); pg.wait_for_selector('.tiles')
    # sets
    pg.click('.tabs a:has-text("Sets")'); pg.click('[data-newset]'); pg.fill('#sname','Thanksgiving casserole')
    pg.fill('#sadd','Green beans, fried onions'); pg.press('#sadd','Enter'); pg.select_option('#socc','thanksgiving')
    pg.screenshot(path='tests/shots/set.png')
    pg.click('#sall'); pg.wait_for_selector('.tiles'); ok(pg.locator('.row',has_text='Fried onions').count()==1,'set adds all items together')
    # memory
    pg.click('.tabs a:has-text("Memory")'); pg.wait_for_selector('.hero'); pg.screenshot(path='tests/shots/memory.png')
    ok(int(pg.inner_text('.hero'))>=3,'memory counts purchases')
    pg.click('.tabs a:has-text("More")'); pg.screenshot(path='tests/shots/more.png')
    # export
    with pg.expect_download() as d1: pg.click('[data-export=json]')
    jpath='/tmp/backup.json'; d1.value.save_as(jpath)
    with pg.expect_download() as d2: pg.click('[data-export=csv]')
    cpath='/tmp/backup.csv'; d2.value.save_as(cpath)
    j=json.load(open(jpath)); ok(j['state']['history'] and len(j['state']['sets'])==1,'json export has history+sets')
    ok(open(cpath).read().startswith('record,name'),'csv export')
    # theme
    pg.click('[data-theme=dark]'); ok(pg.evaluate("document.documentElement.dataset.theme")=='dark','dark theme')
    pg.screenshot(path='tests/shots/more-dark.png')
    ok(not [e for e in errs if 'favicon' not in e],'no console errors %s'%errs)
    # offline
    ctx.set_offline(True); pg.goto(BASE); pg.wait_for_selector('.tiles',timeout=5000); ok(True,'offline reload renders app')
    pg.goto(BASE+'privacy.html'); ok('Privacy' in pg.inner_text('h1'),'privacy page offline')
    ctx.set_offline(False); ctx.close()
    # import into fresh device (json then csv)
    for path,label in [(jpath,'json'),(cpath,'csv')]:
        c2=b.new_context(**IPHONE); p2=c2.new_page(); p2.goto(BASE+'#/more'); p2.wait_for_selector('[data-import]')
        with p2.expect_file_chooser() as fc: p2.click('[data-import]')
        fc.value.set_files(path)
        p2.wait_for_selector('#toast:not([hidden])'); ok('Imported' in p2.inner_text('#toast'),'import %s: %s'%(label,p2.inner_text('#toast').replace('\n',' ')))
        p2.click('.tabs a:has-text("Memory")'); p2.wait_for_selector('.hero'); ok(int(p2.inner_text('.hero'))>=3,'imported history visible (%s)'%label)
        c2.close()

    # ---- C. audit: font sizes, tap targets, contrast on every screen in both themes
    AUD="""()=>{
      const out={small:[],tap:[],contrast:[]};
      const lum=c=>{const [r,g,b]=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
      const parse=s=>{const m=s.match(/[\\d.]+/g).map(Number);return {c:m.slice(0,3),a:m.length>3?m[3]:1}};
      const bgOf=el=>{let e=el;while(e){const p=parse(getComputedStyle(e).backgroundColor);if(p.a>0.9)return p.c;e=e.parentElement}return [255,255,255]};
      for(const el of document.querySelectorAll('body *')){
        const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden')continue;
        const r=el.getBoundingClientRect(); if(!r.width||!r.height)continue;
        const own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
        if(own){ if(parseFloat(cs.fontSize)<18)out.small.push(el.tagName+':'+el.textContent.trim().slice(0,20)+':'+cs.fontSize);
          const fg=parse(cs.color).c,bg=bgOf(el),a=lum(fg),b=lum(bg),cr=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          if(cr<7)out.contrast.push(el.tagName+':'+el.textContent.trim().slice(0,20)+':'+cr.toFixed(2)); }
        if(['BUTTON','A','INPUT','SELECT'].includes(el.tagName)&&(r.height<47.5||r.width<47.5)&&!(el.tagName==='INPUT'&&el.type==='file'))out.tap.push(el.tagName+':'+(el.textContent||el.placeholder||el.ariaLabel||'').trim().slice(0,20)+':'+Math.round(r.width)+'x'+Math.round(r.height));
      }
      return out}"""
    for theme in ['light','dark']:
        c3=b.new_context(color_scheme=theme,**IPHONE); p3=c3.new_page(); at(c3,'2026-10-20'); p3.goto(BASE); p3.wait_for_selector('.tiles')
        # seed data via import for a rich screen
        p3.goto(BASE+'#/more'); p3.wait_for_selector('[data-import]'); 
        with p3.expect_file_chooser() as fc: p3.click('[data-import]')
        fc.value.set_files(jpath); p3.wait_for_timeout(600)
        for h in ['home','add','sets','memory','more','item/'+p3.evaluate("JSON.parse(localStorage.getItem('restock.state')).items[0].id"),'set/'+p3.evaluate("JSON.parse(localStorage.getItem('restock.state')).sets[0].id")]:
            p3.goto(BASE+'#/'+h); p3.wait_for_timeout(500)
            a=p3.evaluate(AUD)
            ok(not a['small'] and not a['tap'] and not a['contrast'],f'{theme} {h.split("/")[0]}: fonts>=18, taps>=48, contrast>=7  {a if (a["small"] or a["tap"] or a["contrast"]) else ""}')
            if h in('home','add'): p3.screenshot(path=f'tests/shots/{theme}-{h}.png')
        c3.close()
    # offers on UI
    c4=b.new_context(**IPHONE); p4=c4.new_page(); at(c4,'2026-11-20'); p4.goto(BASE)
    p4.evaluate("""async()=>{const L=await import('./logic.js');const S=L.emptyState();
      for(const n of ['Turkey','Cranberries','Green beans','Pie crust']){S.history.push({k:L.keyOf(n),n,d:'2025-11-24'});L.ensureItem(S,n);}
      localStorage.setItem('restock.state',JSON.stringify(S));}""")
    p4.reload(); p4.wait_for_selector('.offer'); ok('Thanksgiving' in p4.inner_text('.offer'),'home shows Thanksgiving offer')
    p4.screenshot(path='tests/shots/home-offer.png')
    p4.click('.offer'); p4.wait_for_selector('.pick'); p4.click('.pick >> nth=0'); p4.screenshot(path='tests/shots/offer.png')
    p4.click('[data-offer-add]'); p4.wait_for_selector('.row'); ok(p4.locator('.row').count()==3,'offer adds selected 3 of 4')
    c4.close()
    # license gate (product id set) - simulate by serving modified config
    b.close()
print('FAILS:',fails); sys.exit(1 if fails else 0)
