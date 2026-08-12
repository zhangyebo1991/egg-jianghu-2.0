# -*- coding: utf-8 -*-
"""
诸天刷宝录 → game-design-lab 技能图鉴数据生成器

从游戏解包目录 _analysis/ 下的 Construct c2array JSON 提取势力/技能/角色/物品数据，
输出为前端可直接 import 的 TypeScript 数据文件。

数据来源（证据等级 A：游戏包内数据表解包）：
  shili.json  势力表   42 势力 × 26 字段（列=势力）
  jn.json     技能表   378 技能 × 52 字段（列=技能）
  lsjn.json   通用被动 144 个属性被动技能 × 5 字段
  js.json     角色表   194 角色 × 37 字段
  wp.json     物品表   1793 物品 × 40 字段
  buff.json   状态表   68 个 buff（用于丰富技能描述里的 buff 引用）

用法：
  python scripts/gen-codex.py [ANALYSIS_DIR] [OUT_DIR]
默认 ANALYSIS_DIR 指向诸天刷宝录的 _analysis，OUT_DIR 指向 src/data/codex。
"""
import json
import os
import re
import sys

# 元素 ID → 名称（与研究快照「8 系元素」一致，顺序：雷水火木土精神神圣黑暗）
ELEMENT_MAP = {0: "无", 1: "雷", 2: "水", 3: "火", 4: "木", 5: "土", 6: "精神", 7: "神圣", 8: "黑暗"}
# 技能类别 ID → 名称（与研究快照「16 类技能」一致）
CATEGORY_MAP = {
    1: "通用", 2: "战技", 3: "武功", 4: "符咒", 5: "箭弩", 6: "方术", 7: "异能",
    8: "神技", 9: "斗气", 10: "忍术", 11: "魔法", 12: "功法", 13: "枪械", 14: "机甲",
    15: "召唤", 16: "医术",
}
# 势力系列分组 ID → 名称（按 shili row2 的 1-13 分组归纳）
SERIES_MAP = {
    1: "东汉三国", 2: "武侠江湖", 3: "摸金盗墓", 4: "十字东征", 5: "聊斋志异",
    6: "东瀛战国", 7: "二战风云", 8: "修真仙侠", 9: "科幻星战", 10: "西幻魔法",
    11: "联盟部落", 12: "漫威英雄", 13: "神话天庭",
}
# 通用被动技能阶数
PASSIVE_TIER_MAP = {1: "初级", 2: "中级", 3: "高级", 4: "终极"}

# 位面声望阶位（mc.json row13）：招募角色所需声望等级
REP_TIER_MAP = {1: "冷淡", 2: "友好", 3: "尊敬", 4: "崇拜", 5: "信仰"}
REP_TIER_COLOR = {
    1: "var(--c-muted)",   # 冷淡 white
    2: "var(--c-green)",   # 友好 lightgreen
    3: "var(--c-fuchsia)", # 尊敬 Fuchsia
    4: "var(--c-orange)",  # 崇拜 orange
    5: "var(--c-red)",     # 信仰 red
}

# BBCode [color=c]...[/color] 的颜色映射 → CSS 变量（与前端主题协同）
COLOR_VAR = {
    "red": "var(--c-red)", "orange": "var(--c-orange)", "yellow": "var(--c-gold)",
    "lightblue": "var(--c-cyan)", "lightgreen": "var(--c-green)", "lightblue2": "var(--c-cyan)",
    "fuchsia": "var(--c-fuchsia)", "Fuchsia": "var(--c-fuchsia)", "green": "var(--c-green)",
    "blue": "var(--c-cyan)", "white": "var(--c-text)", "gray": "var(--c-muted)",
    "grey": "var(--c-muted)", "purple": "var(--c-purple)", "pink": "var(--c-fuchsia)",
}

COLOR_TAG_RE = re.compile(r"\[color=([^\]]+)\](.*?)\[/color\]", re.IGNORECASE | re.DOTALL)


def strip_color(text):
    """剥除 BBCode 颜色标签，返回纯文本。"""
    if not isinstance(text, str):
        return text
    prev = None
    cur = text
    while prev != cur:
        prev = cur
        cur = COLOR_TAG_RE.sub(lambda m: m.group(2), cur)
    return cur


def html_color(text):
    """把 BBCode 颜色标签转成 <span style="color:..."> 富文本，其余 HTML 转义。"""
    if not isinstance(text, str):
        return ""

    def esc(s):
        return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

    def repl(m):
        color = m.group(1).strip()
        inner = esc(m.group(2))
        var = COLOR_VAR.get(color, "var(--c-text)")
        return f'<span style="color:{var}">{inner}</span>'

    # 先转义，但颜色标签本身需要保留→改为占位符法：先提取标签，转义其余文本
    parts = []
    last = 0
    for m in COLOR_TAG_RE.finditer(text):
        parts.append(esc(text[last:m.start()]))
        color = m.group(1).strip()
        inner = esc(m.group(2))
        var = COLOR_VAR.get(color, "var(--c-text)")
        parts.append(f'<span style="color:{var}">{inner}</span>')
        last = m.end()
    parts.append(esc(text[last:]))
    return "".join(parts)


def load_c2array(fn):
    """读取 Construct c2array JSON，返回 rows[y][x]（行=字段，列=记录）。"""
    d = json.load(open(fn, encoding="utf-8"))
    w, h, _depth = d["size"]
    data = d["data"]

    def cell(x, y):
        try:
            return data[x][y][0]
        except (IndexError, KeyError, TypeError):
            return None

    rows = [[cell(x, y) for x in range(w)] for y in range(h)]
    return w, h, rows


def num(v, default=0):
    """安全转数字，空字符串/None → default。"""
    if v is None or v == "":
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return float(v)
        except (TypeError, ValueError):
            return default


def parse_kind(desc_plain):
    """从描述开头的 【XXX】 解析技能功能类型。"""
    if not isinstance(desc_plain, str):
        return ""
    m = re.match(r"\s*【([^】]+)】", desc_plain)
    return m.group(1) if m else ""


def derive_range(desc_plain, target_side):
    """从描述文本归纳目标范围：单体/范围/全体/自身/随机。"""
    if not isinstance(desc_plain, str):
        return ""
    if "全体" in desc_plain:
        return "全体"
    if "范围" in desc_plain or "群体" in desc_plain:
        return "范围"
    if "随机" in desc_plain:
        return "随机"
    if "自身" in desc_plain and target_side == "我方":
        return "自身"
    if "单体" in desc_plain:
        return "单体"
    return ""


# ---------------- 数据提取 ----------------

def extract_skills(jn_path, buff_names):
    """提取 378 个技能。"""
    w, h, rows = load_c2array(jn_path)
    skills = []
    for c in range(0, w):  # 含 col0「防御」基础动作，保证 id 与角色/势力引用一致
        name = rows[1][c]
        if not name:
            continue
        cat_id = num(rows[4][c])
        elem_id = num(rows[5][c])
        desc_raw = rows[14][c] or ""
        desc_plain = strip_color(desc_raw)
        kind = parse_kind(desc_plain)
        damage_type = rows[26][c] or ""
        target_side = rows[39][c] or ""
        # 替换描述里的 <buff名> 占位为真实 buff 名（如能匹配）
        desc_plain_final = desc_plain
        desc_html_final = html_color(desc_raw)
        skills.append({
            "id": c,
            "name": name,
            "kind": kind,
            "categoryId": cat_id,
            "category": CATEGORY_MAP.get(cat_id, "未知"),
            "elementId": elem_id,
            "element": ELEMENT_MAP.get(elem_id, "无"),
            "damageType": damage_type,
            "targetSide": target_side,
            "range": derive_range(desc_plain, target_side),
            "power": num(rows[9][c]),
            "energyCost": num(rows[44][c]),
            "cooldown": num(rows[46][c]),
            "buffChance": num(rows[22][c]),
            "buffValue": num(rows[25][c]),
            "hitEffect": rows[34][c] or "",
            "learnReq": num(rows[49][c]),
            "descZh": desc_plain_final,
            "descHtml": desc_html_final,
            "descEn": html_color(rows[50][c] or ""),
        })
    return skills


def extract_factions(shili_path):
    """提取 42 个势力，并把每个势力的 6 个技能列索引带出。"""
    w, h, rows = load_c2array(shili_path)
    factions = []
    for c in range(1, w):
        name = rows[1][c]
        if not name or name == "无":
            # col1 的 label 是 "无"，但武馆在 col1... 实际 col1=武馆。重新核对：row1[1]="武馆"
            pass
        if not name:
            continue
        series_id = num(rows[2][c])
        skill_ids = [num(rows[r][c]) for r in (5, 6, 7, 8, 9, 10)]
        # 过滤掉 0（空槽）
        skill_ids = [s for s in skill_ids if s > 0]
        factions.append({
            "id": c,
            "name": name,
            "seriesId": series_id,
            "series": SERIES_MAP.get(series_id, "未知"),
            "descHtml": html_color(rows[3][c] or ""),
            "descZh": strip_color(rows[3][c] or ""),
            "currency": rows[4][c] or "",
            "type": rows[11][c] or "",
            "skillGroup": rows[23][c] or "",
            "skillIds": skill_ids,
        })
    return factions


def extract_passives(lsjn_path):
    """提取 144 个通用属性被动技能。"""
    w, h, rows = load_c2array(lsjn_path)
    passives = []
    for c in range(1, w):
        name = rows[1][c]
        if not name:
            continue
        tier_id = num(rows[2][c])
        passives.append({
            "id": c,
            "name": name,
            "tierId": tier_id,
            "tier": PASSIVE_TIER_MAP.get(tier_id, "未知"),
            "attributeId": num(rows[3][c]),
            "cost": num(rows[4][c]),
        })
    return passives


def extract_characters(js_path, plane_map):
    """提取 194 个角色。plane_map: 位面 ID → 位面名（来自 wm.json row1）。"""
    w, h, rows = load_c2array(js_path)
    chars = []
    for c in range(1, w):
        name = rows[1][c]
        if not name:
            continue
        growth = [num(rows[r][c]) for r in (7, 8, 9, 10, 11)]  # 勇 智 体 敏 精
        skill_ids = [num(rows[r][c]) for r in (28, 29, 30, 31)]
        skill_ids = [s for s in skill_ids if s > 0]
        plane_id = num(rows[5][c])
        rep_tier = num(rows[22][c])  # 招募所需位面声望阶位（0=无）
        chars.append({
            "id": c,
            "name": name,
            "race": rows[2][c] or "",
            "title": rows[27][c] or "",
            "gender": rows[24][c] or "",
            "factionId": num(rows[25][c]),
            "planeId": plane_id,
            "plane": plane_map.get(plane_id, "未知"),
            "reputationTier": rep_tier,
            "reputation": REP_TIER_MAP.get(rep_tier, ""),
            "reputationColor": REP_TIER_COLOR.get(rep_tier, "var(--muted)"),
            "growth": {"yong": growth[0], "zhi": growth[1], "ti": growth[2], "min": growth[3], "jing": growth[4]},
            "price": num(rows[26][c]),
            "skillIds": skill_ids,
            "bioZh": strip_color(rows[23][c] or ""),
            "bioHtml": html_color(rows[23][c] or ""),
        })
    return chars


def extract_plane_map(wm_path):
    """位面 ID → 位面名（wm.json row1）。"""
    _w, _h, rows = load_c2array(wm_path)
    return {i: (rows[1][i] if i < len(rows[1]) else "未知") for i in range(len(rows[1]))}


def extract_items(wp_path):
    """提取物品（保留名称/描述/价格，按名称归类）。"""
    w, h, rows = load_c2array(wp_path)
    items = []
    for c in range(1, w):
        name = rows[1][c]
        if not name:
            continue
        items.append({
            "id": c,
            "name": name,
            "descZh": strip_color(rows[10][c] or ""),
            "price": num(rows[8][c]),
            "value": num(rows[34][c]),
        })
    return items


def extract_buffs(buff_path):
    w, h, rows = load_c2array(buff_path)
    buffs = {}
    for c in range(1, w):
        name = rows[1][c]
        if name:
            buffs[c] = name
    return buffs


# ---------------- 输出 ----------------

def js(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def write_ts(path, const_name, type_name, data, header_lines=None):
    with open(path, "w", encoding="utf-8") as f:
        f.write("/* eslint-disable */\n")
        f.write("// 该文件由 scripts/gen-codex.py 自动生成，请勿手工编辑。\n")
        f.write("// 数据来源：诸天刷宝录 游戏包解包 (_analysis/*.json)，证据等级 A。\n")
        if header_lines:
            for ln in header_lines:
                f.write("// " + ln + "\n")
        f.write("\n")
        f.write(f"import type {{ {type_name} }} from './types'\n\n")
        f.write(f"export const {const_name}: {type_name}[] = ")
        # 用紧凑 JSON；中文不转义
        f.write(json.dumps(data, ensure_ascii=False, indent=2))
        f.write("\n")


def main():
    analysis_dir = sys.argv[1] if len(sys.argv) > 1 else r"D:/Projects/OpenProject/花旦的各种小游戏/挂机游戏/诸天刷宝录/_analysis"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "src", "data", "codex")
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)

    buffs = extract_buffs(os.path.join(analysis_dir, "buff.json"))
    plane_map = extract_plane_map(os.path.join(analysis_dir, "wm.json"))
    skills = extract_skills(os.path.join(analysis_dir, "jn.json"), buffs)
    factions = extract_factions(os.path.join(analysis_dir, "shili.json"))
    passives = extract_passives(os.path.join(analysis_dir, "lsjn.json"))
    characters = extract_characters(os.path.join(analysis_dir, "js.json"), plane_map)
    items = extract_items(os.path.join(analysis_dir, "wp.json"))

    write_ts(os.path.join(out_dir, "factions.generated.ts"), "factionsRaw", "Faction", factions)
    write_ts(os.path.join(out_dir, "skills.generated.ts"), "skillsRaw", "Skill", skills)
    write_ts(os.path.join(out_dir, "passives.generated.ts"), "passivesRaw", "PassiveSkill", passives)
    write_ts(os.path.join(out_dir, "characters.generated.ts"), "charactersRaw", "Character", characters)
    write_ts(os.path.join(out_dir, "items.generated.ts"), "itemsRaw", "GameItem", items)

    print(f"生成完成 → {out_dir}")
    print(f"  factions={len(factions)} skills={len(skills)} passives={len(passives)} characters={len(characters)} items={len(items)}")


if __name__ == "__main__":
    main()
