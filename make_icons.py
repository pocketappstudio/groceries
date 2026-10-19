from PIL import Image, ImageDraw
import math
def draw(size, maskable=False):
    S=size*4
    im=Image.new('RGB',(S,S))
    px=im.load()
    # vertical gradient deep green
    top=(18,92,60); bot=(7,48,32)
    d=ImageDraw.Draw(im)
    for y in range(S):
        t=y/S
        d.line([(0,y),(S,y)],fill=tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3)))
    pad=0.20 if maskable else 0.15
    x0=S*pad; x1=S*(1-pad); y0=S*(pad+0.02); y1=S*(1-pad+0.02)
    r=S*0.09
    # shadow
    sh=Image.new('RGBA',(S,S),(0,0,0,0)); sd=ImageDraw.Draw(sh)
    sd.rounded_rectangle([x0,y0+S*0.02,x1,y1+S*0.02],r,fill=(0,0,0,90))
    from PIL import ImageFilter
    sh=sh.filter(ImageFilter.GaussianBlur(S*0.015))
    im=Image.alpha_composite(im.convert('RGBA'),sh)
    d=ImageDraw.Draw(im)
    d.rounded_rectangle([x0,y0,x1,y1],r,fill=(250,246,236))
    # header band
    band=(x1-x0)*0.22
    d.rounded_rectangle([x0,y0,x1,y0+band],r,fill=(234,170,60))
    d.rectangle([x0,y0+band-r,x1,y0+band],fill=(234,170,60))
    # binder rings
    for fx in (0.3,0.7):
        cx=x0+(x1-x0)*fx
        d.rounded_rectangle([cx-S*0.015,y0-S*0.03,cx+S*0.015,y0+band*0.45],S*0.015,fill=(250,246,236))
    # check mark
    w=x1-x0; h=y1-y0-band
    cx=x0+w*0.5; cy=y0+band+h*0.5
    pts=[(cx-w*0.24,cy+h*0.0),(cx-w*0.07,cy+h*0.2),(cx+w*0.26,cy-h*0.22)]
    lw=int(S*0.075)
    d.line(pts,fill=(10,91,56),width=lw,joint='curve')
    for p in (pts[0],pts[2]):
        d.ellipse([p[0]-lw/2,p[1]-lw/2,p[0]+lw/2,p[1]+lw/2],fill=(10,91,56))
    return im.convert('RGB').resize((size,size),Image.LANCZOS)
for n,s,m in [('apple-touch-icon.png',180,False),('icon-192.png',192,False),('icon-512.png',512,False),('icon-maskable-512.png',512,True)]:
    draw(s,m).save('icons/'+n)
