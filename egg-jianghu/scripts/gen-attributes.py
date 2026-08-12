# -*- coding: utf-8 -*-
"""
诸天刷宝录 sx.json → egg-jianghu 属性注册表生成器

从 _analysis/sx.json (Construct c2array) 提取 202 个属性，输出为
egg-jianghu/src/content/attributes.ts（证据等级 A：游戏包内数据表解包）。

sx.json 字段（data[id][field]，id=1..202，field=0..11）：
  [0]id [1]名 [2]分类 [3]默认 [4]单位 [5]预留(0) [6]计算类型
  [7]词条 [8]capMin(减伤/抗性类上限:80/95) [9]capMax(增伤/威力类roll上限)
  [10]战斗标志 [11]界面标志

用法：
  python scripts/gen-attributes.py [ANALYSIS_DIR] [OUT_FILE]
"""
import json
import os
import sys

DEFAULT_ANALYSIS = r'D:/Projects/OpenProject/花旦的各种小游戏/挂机游戏/诸天刷宝录/_analysis'
DEFAULT_OUT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'src', 'content', 'attributes.ts',
)


def load_c2array(fn):
    """读取 Construct c2array JSON，返回 rows[field][record]。"""
    d = json.load(open(fn, encoding='utf-8'))
    w, h, _depth = d['size']
    data = d['data']

    def cell(x, y):
        try:
            return data[x][y][0]
        except (IndexError, KeyError, TypeError):
            return None

    rows = [[cell(x, y) for x in range(w)] for y in range(h)]
    return w, h, rows


def num(v, default=0):
    if v is None or v == '':
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return float(v)
        except (TypeError, ValueError):
            return default


def s(v):
    """TS 字符串字面量。"""
    return json.dumps(v if v is not None else '', ensure_ascii=False)


def main():
    analysis = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_ANALYSIS
    out = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUT

    w, h, rows = load_c2array(os.path.join(analysis, 'sx.json'))

    attrs = []
    for x in range(w):
        aid = rows[0][x]
        if aid is None or aid == 0 or aid == '0':
            continue
        attrs.append({
            'id': num(aid),
            'name': rows[1][x] or '',
            'category': rows[2][x] or '',
            'default': num(rows[3][x]),
            'unit': rows[4][x] or '',
            'calcType': rows[6][x] or '',
            'affix': rows[7][x] or '',
            'capMin': num(rows[8][x]),
            'capMax': num(rows[9][x]),
            'combatFlag': rows[10][x] == 1 or rows[10][x] == '1',
            'uiFlag': rows[11][x] == 1 or rows[11][x] == '1',
        })

    attrs.sort(key=lambda a: a['id'])

    categories = sorted({a['category'] for a in attrs})
    units = sorted({a['unit'] for a in attrs})
    calc_types = sorted({a['calcType'] for a in attrs})

    L = []
    L.append('/**')
    L.append(' * 属性注册表（202 属性）——由《诸天刷宝录》sx.json 解包生成（证据等级 A）。')
    L.append(' * 生成器：scripts/gen-attributes.py；请改源数据后重跑，勿手改本文件。')
    L.append(' *')
    L.append(' * sx.json 是属性中枢：装备词条 / buff / 技能效果 / 势力威力 / 元素威力')
    L.append(' * 全部以 id（1..202）为外键。战斗公式的 18 个乘区直接按 id 读取面板值。')
    L.append(' */')
    L.append('')
    L.append('export type AttributeCategory = ' + ' | '.join(s(c) for c in categories))
    L.append('export type AttributeUnit = ' + ' | '.join(s(u) for u in units))
    L.append('export type AttributeCalcType = ' + ' | '.join(s(c) for c in calc_types))
    L.append('')
    L.append('export interface AttributeDefinition {')
    L.append('  id: number')
    L.append('  name: string')
    L.append('  category: AttributeCategory')
    L.append('  /** 默认值（sx.json 第 4 字段） */')
    L.append('  default: number')
    L.append('  unit: AttributeUnit')
    L.append('  /** 计算类型：乘法 / 指数 / 固定 / 增幅（决定面板成长与结算形态） */')
    L.append('  calcType: AttributeCalcType')
    L.append('  /** 词条前缀（sx.json 第 8 字段）；战斗隐藏/技能被动类为空或「无」 */')
    L.append('  affix: string')
    L.append('  /** 减伤/抗性类的生效上限（物法减伤/最终减伤/元素抗性=80；受 X 伤害=95）；其余为 0 */')
    L.append('  capMin: number')
    L.append('  /** 增伤/威力类的 roll 上限（增伤=1500、最终增伤=1000、技能组=1500）；部分减伤类=750 */')
    L.append('  capMax: number')
    L.append('  /** 是否参与战斗结算 */')
    L.append('  combatFlag: boolean')
    L.append('  /** 是否在角色界面显示 */')
    L.append('  uiFlag: boolean')
    L.append('}')
    L.append('')
    L.append('export const ATTRIBUTES: AttributeDefinition[] = [')

    for a in attrs:
        L.append(
            f"  {{ id: {a['id']}, name: {s(a['name'])}, category: {s(a['category'])}, "
            f"default: {a['default']}, unit: {s(a['unit'])}, calcType: {s(a['calcType'])}, "
            f"affix: {s(a['affix'])}, capMin: {a['capMin']}, capMax: {a['capMax']}, "
            f"combatFlag: {str(a['combatFlag']).lower()}, uiFlag: {str(a['uiFlag']).lower()} }},"
        )

    L.append(']')
    L.append('')
    L.append('/** 按 id 索引（1..202） */')
    L.append('export const ATTRIBUTE_BY_ID: Record<number, AttributeDefinition> = Object.fromEntries(')
    L.append('  ATTRIBUTES.map((a) => [a.id, a]),')
    L.append(')')
    L.append('')
    L.append('/** 属性 id（1..202），即 sx.json 的属性编号 */')
    L.append('export type AttributeId = number')
    L.append('/** 角色属性面板：属性 id → 数值。这是诸天模型的统一属性载体，替代原散落的 CombatStats 字段 */')
    L.append('export type AttributeMap = Record<AttributeId, number>')
    L.append('')

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L))

    print(f'Generated {out}')
    print(f'  attributes: {len(attrs)} (id {attrs[0]["id"]}..{attrs[-1]["id"]})')
    print(f'  categories({len(categories)}): {categories}')
    print(f'  units({len(units)}): {units}')
    print(f'  calcTypes({len(calc_types)}): {calc_types}')


if __name__ == '__main__':
    main()
