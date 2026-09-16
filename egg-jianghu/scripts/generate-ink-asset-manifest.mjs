import { readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const app = fileURLToPath(new URL('..', import.meta.url))
const entries = []
const addDirectory = async (folder, pattern, target, size, framing, priority) => {
  for (const name of (await readdir(resolve(app, 'src/assets', folder))).filter(name => pattern.test(name)).sort()) {
    const stem = name.replace(/\.(webp|png)$/, '')
    entries.push({
      key: `${target}/${stem}`,
      priority,
      source: `egg-jianghu/src/assets/${folder}/${name}`,
      output: `egg-jianghu/src/assets/ink/${target}/${stem}.png`,
      size,
      prompt: `参考 source 对应原图，保留角色身份、物种、服饰、兵器或物品类别，仅重绘为中国水墨风。${framing}。松烟墨、暖宣纸、干笔飞白，朱砂点缀不超过画面 3%，不用金色和霓虹。不要文字、边框、印章或水印。`,
    })
  }
}
await addDirectory('heroes/original', /^hero_\d+\.webp$/, 'portraits', [512, 512], '肩部以上胸像，头部居中，脸位于中心上方，主体落在中央 70% 的安全圆内，深墨底 #191611', 'P1')
await addDirectory('heroes/original', /^(hero|skin)_\d+\.webp$/, 'figures', [768, 1024], '完整人物立绘，透明背景，站姿，不裁断兵器，人物占画高 88%，脚底距下沿 4%', 'P2')
await addDirectory('enemies/zt', /^zt_(\d+|s\d+)\.webp$/, 'enemies', [512, 512], '敌人半身像或怪物特写，深墨底 #191611，主体位于中央 70% 安全圆，保留原物种', 'P1')
await addDirectory('equipment/zt', /^zt_eq_\d+\.webp$/, 'equipment', [512, 512], '单件物品静物图，深墨底 #211d16，主体占中央 75%，底部 18% 留给游戏叠加名称', 'P1')
await addDirectory('skills/original', /^skill_\d+\.webp$/, 'skills', [256, 256], '技能意象图，单一清晰轮廓，深墨底 #191611，32px 缩略尺寸仍可辨识', 'P2')
await addDirectory('careers/original', /^career_\d+\.webp$/, 'careers', [256, 256], '职业纹样或兵器意象，深墨底 #191611，保留原职业识别元素，32px 缩略尺寸清晰', 'P2')
const counts = Object.fromEntries([...new Set(entries.map(entry => entry.key.split('/')[0]))].map(category => [category, entries.filter(entry => entry.key.startsWith(`${category}/`)).length]))
const destination = resolve(app, '../docs/UI素材索引_水墨实装_v2.json')
await writeFile(destination, `${JSON.stringify({ version: 2, counts, note: 'PNG 与 WebP 二选一；同名同时存在时游戏优先 WebP。按 priority 分批生成，source 是身份与物种的参考依据。', entries }, null, 2)}\n`)
console.log(JSON.stringify({ destination, total: entries.length, counts }, null, 2))
