import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'
const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../../../诸天刷宝录/_analysis')
const load = name => JSON.parse(readFileSync(resolve(source, name + '.json'), 'utf8')).data.map(r => r.map(c => c[0]))
const data = JSON.parse(readFileSync(resolve(source, 'data.json'), 'utf8'))
let object
const walk = n => { if (!Array.isArray(n) || object) return; if (n[0] === '角色形象' && n.length > 8) { object=n; return }; n.forEach(walk) }
walk(data.project)
let animations
const frame = f => Array.isArray(f) && typeof f[0] === 'string' && f[0].startsWith('images/')
const anim = a => Array.isArray(a) && typeof a[0] === 'string' && Array.isArray(a.at(-1)) && a.at(-1).length && a.at(-1).every(frame)
const find = n => { if (!Array.isArray(n) || animations) return; if(n.length && n.every(anim)){animations=n;return};n.forEach(find) }
find(object)
if(!animations) throw Error('未找到角色形象动画')
const frames = new Map(animations.map(a=>[a[0],a.at(-1)[0]]))
const heroes = load('js').filter(r=>Number(r[0])>0 && r[1]).map(r=>({id:Number(r[0]),name:r[1],imageKey:String(r[3])}))
const skins = load('hh').filter(r=>Number(r[0])>0 && r[1]).map(r=>({id:Number(r[0]),imageKey:String(r[1]),heroSourceId:Number(r[2]),type:Number(r[4]),source:String(r[5]),attributeIds:[...new Set([6,8,10,12,14,16].map(i=>Number(r[i])).filter(Boolean))]}))
const requests = [...heroes.map(h=>({key:h.imageKey,file:`hero_${h.id}`})), ...skins.map(s=>({key:s.imageKey,file:`skin_${s.id}`}))]
const missing = requests.filter(r=>!frames.has(r.key))
if(missing.length) throw Error('缺少动画: '+JSON.stringify(missing))
const sheets=resolve(here,'tmp/skin-sheets'); mkdirSync(sheets,{recursive:true})
const sheetNames=[...new Set(requests.map(r=>frames.get(r.key)[0]))]
const zipPath=resolve(source,'../.nw')
execFileSync('python',['-X','utf8','-c',`import zipfile,sys,json,pathlib
with zipfile.ZipFile(sys.argv[1]) as z:
 for n in json.loads(sys.argv[3]):
  pathlib.Path(sys.argv[2],pathlib.PurePosixPath(n).name).write_bytes(z.read(n))`,zipPath,sheets,JSON.stringify(sheetNames)],{stdio:'pipe'})
const out=resolve(here,'../src/assets/heroes/original');mkdirSync(out,{recursive:true})
for(const req of requests){
 const f=frames.get(req.key), rotated=f[6]===true
 let im=sharp(resolve(sheets,basename(f[0]))).extract({left:f[2],top:f[3],width:rotated?f[5]:f[4],height:rotated?f[4]:f[5]})
 if(rotated) im=im.rotate(-90)
 await im.webp({quality:85}).toFile(resolve(out,req.file+'.webp'))
}
writeFileSync(resolve(here,'../src/content/hero-skins.generated.ts'),`// 从原版 js / hh 表与角色形象图集提取；运行 scripts/generate-hero-skins.mjs 重建。\nexport const ORIGINAL_HERO_APPEARANCES = ${JSON.stringify(heroes)} as const\nexport const HERO_SKINS = ${JSON.stringify(skins)} as const\n`)
console.log(`提取 ${heroes.length} 角色、${skins.length} 皮肤，${requests.length} 张立绘`)
