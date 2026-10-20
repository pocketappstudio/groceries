import datetime
from playwright.sync_api import sync_playwright
B='http://localhost:8765/'
SEED="""async()=>{const L=await import('./logic.js');const st=await import('./store.js');let S=L.emptyState();
const add=(n,ds)=>{for(const d of ds)S.history.push({k:L.keyOf(n),n,d});L.ensureItem(S,n);};
const wk=(start,step,count)=>{const o=[];let t=new Date(start+'T12:00:00');for(let i=0;i<count;i++){o.push(t.toISOString().slice(0,10));t=new Date(t.getTime()+step*864e5);}return o;};
// back-dated so every recurring item is due today or later (no Overdue labels) on Nov 16, 2026
const back=(last,step,count)=>{const o=[];let t=new Date(last+'T12:00:00');for(let i=0;i<count;i++){o.unshift(t.toISOString().slice(0,10));t=new Date(t.getTime()-step*864e5);}return o;};
add('Milk',back('2026-11-10',7,15));add('Eggs',back('2026-11-07',10,10));add('Bread',back('2026-11-13',6,17));add('Bananas',back('2026-11-12',5,20));
add('Coffee',back('2026-11-03',21,5));add('Yogurt',back('2026-11-15',8,12));add('Paper towels',back('2026-11-01',30,5));add('Dish soap',back('2026-10-20',45,4));
for(const n of ['Turkey','Cranberries','Green beans','Fried onions','Sweet potatoes','Rolls','Pumpkin pie'])add(n,['2025-11-24']);
for(const it of S.items)L.recompute(S,it);
L.addSet(S,'Thanksgiving casserole',['Green beans','Fried onions','Cream of mushroom soup'],'thanksgiving');
L.addSet(S,'Taco night',['Tortillas','Ground beef','Cheddar','Salsa','Lettuce']);
L.addNames(S,['Apples','Spinach','Olive oil']);
L.refreshDue(S,'2026-11-16');S.updated=Date.now();await st.set('state',S);}"""
with sync_playwright() as p:
  b=p.chromium.launch()
  for theme in ['light','dark']:
    c=b.new_context(viewport={'width':440,'height':956},device_scale_factor=3,is_mobile=True,has_touch=True,color_scheme=theme)
    c.clock.set_fixed_time(datetime.datetime(2026,11,16,10,0))
    pg=c.new_page();pg.goto(B);pg.wait_for_selector('.tiles');pg.evaluate(SEED);pg.reload();pg.wait_for_selector('.tiles')
    for i,(h,name) in enumerate([('#/home','home'),('#/add','add'),('#/memory','memory'),('#/sets','sets')]):
      pg.goto(B+h);pg.wait_for_timeout(700);pg.screenshot(path=f'appstore/screenshots/{i+1}-{name}-{theme}.png')
    pg.goto(B+'#/home');pg.wait_for_timeout(500)
    pg.goto(B+'#/offer/h:thanksgiving:2026');pg.wait_for_timeout(700);pg.screenshot(path=f'appstore/screenshots/5-thanksgiving-{theme}.png')
    mid=pg.evaluate("async()=>{const st=await import('./store.js');const S=await st.get('state');return S.items.find(i=>i.name=='Milk').id}")
    pg.goto(B+'#/item/'+mid);pg.wait_for_timeout(700);pg.screenshot(path=f'appstore/screenshots/6-milk-recurring-{theme}.png')
    c.close()
