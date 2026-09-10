// 原版数据处理function 的 jn 初始化；不能用尚未初始化的 jn[16] 推断技能威力。
// 证据：docs/evidence/original-world/all-skills-runtime-audit.json。
const categories = [0, .85, .9, .94, .98, .96, .92, .95, 1, 1.1, 1.15, 1.15, 1.1, 1.15, 1.05, 1.05, 1]
const elements = [1, 1.04, .96, 1.02, 1, .98, .94, 1.06, 1.08]
const ranges = [0, 1, .8, .7, .65, .6, .55, .5, .48, .46, .44, .42, .4, .4, .4, .4]

export const initializeOriginalSkills = (rows, fw) => rows.map((source) => {
  const row = [...source]
  if (!(Number(row[0]) > 0)) return row
  if (row[26] === '物理' || row[26] === '法术') {
    const category = categories[Number(row[4])]
    const element = elements[Number(row[5])]
    const range = ranges[Number(fw[Number(row[37])]?.[20])]
    if (category === undefined || element === undefined || !range) {
      throw new Error(`jn#${row[0]} 初始化系数缺失`)
    }
    const healing = row[15] === '生命治疗' ? .55 : 1
    row[16] = Math.ceil(healing * element * category * range
      * (90 + 10 * Math.pow(1.5, Number(row[6]) - 1))
      * Math.pow(1.5 + Number(row[6]) / 40, Number(row[19])))
    row[17] = 10 * (row[16] / 50)
  }
  row[20] = Number(row[19]) * 4
  return row
})
