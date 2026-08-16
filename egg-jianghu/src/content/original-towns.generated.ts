/**
 * 原版位面城镇快照——由《诸天刷宝录》cj.json 与 mc.json 解包生成。
 * 生成器：scripts/generate-original-world-evidence.mjs；请勿手改本文件。
 */

export interface OriginalTownFunctionDefinition {
  sourceId: number
  name: string
}

export interface OriginalTownSceneDefinition {
  sourceId: number
  name: string
  visualKey: string
  mapMarkerVisualKey: string
  npcTitle: string
  npcVisualKey: string
  dialogueId: number
  functions: readonly OriginalTownFunctionDefinition[]
}

export interface OriginalFactionTownDefinition extends OriginalTownSceneDefinition {
  factionSourceId: number
}

export interface OriginalWorldTownDefinition {
  worldIndex: number
  mainCity: OriginalTownSceneDefinition
  publicLocations: readonly OriginalTownSceneDefinition[]
  factionTowns: readonly OriginalFactionTownDefinition[]
}

export const ORIGINAL_WORLD_TOWNS: readonly OriginalWorldTownDefinition[] = [
  {
    "worldIndex": 1,
    "mainCity": {
      "sourceId": 1,
      "name": "洛阳",
      "visualKey": "1",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 39,
        "name": "府衙",
        "visualKey": "府衙",
        "mapMarkerVisualKey": "府衙",
        "npcTitle": "府尹",
        "npcVisualKey": "府尹",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 36,
        "name": "商会",
        "visualKey": "商会",
        "mapMarkerVisualKey": "商会",
        "npcTitle": "商会老板",
        "npcVisualKey": "商会老板",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 35,
        "name": "酒馆",
        "visualKey": "酒馆",
        "mapMarkerVisualKey": "酒馆",
        "npcTitle": "掌柜",
        "npcVisualKey": "掌柜",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 37,
        "name": "武馆",
        "visualKey": "武馆",
        "mapMarkerVisualKey": "武馆",
        "npcTitle": "武师",
        "npcVisualKey": "武师",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 41,
        "name": "铁匠铺",
        "visualKey": "铁匠铺",
        "mapMarkerVisualKey": "铁匠铺",
        "npcTitle": "铁匠",
        "npcVisualKey": "铁匠",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 42,
        "name": "许昌",
        "visualKey": "古代城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "将军",
        "npcVisualKey": "将军",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 2
      },
      {
        "sourceId": 43,
        "name": "成都",
        "visualKey": "古代城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "将军",
        "npcVisualKey": "将军",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 3
      },
      {
        "sourceId": 44,
        "name": "建业",
        "visualKey": "古代城镇3",
        "mapMarkerVisualKey": "0",
        "npcTitle": "将军",
        "npcVisualKey": "将军",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 4
      }
    ]
  },
  {
    "worldIndex": 2,
    "mainCity": {
      "sourceId": 2,
      "name": "襄阳",
      "visualKey": "2",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 81,
        "name": "衙门",
        "visualKey": "衙门",
        "mapMarkerVisualKey": "衙门",
        "npcTitle": "官吏",
        "npcVisualKey": "府尹",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 82,
        "name": "市集",
        "visualKey": "市集",
        "mapMarkerVisualKey": "市集",
        "npcTitle": "小贩",
        "npcVisualKey": "小贩",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 83,
        "name": "客栈",
        "visualKey": "客栈",
        "mapMarkerVisualKey": "客栈",
        "npcTitle": "小二",
        "npcVisualKey": "小二",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 84,
        "name": "丐帮",
        "visualKey": "丐帮",
        "mapMarkerVisualKey": "丐帮",
        "npcTitle": "乞丐",
        "npcVisualKey": "乞丐",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 85,
        "name": "锻冶坊",
        "visualKey": "铁匠铺",
        "mapMarkerVisualKey": "锻冶坊",
        "npcTitle": "冶炼工",
        "npcVisualKey": "铁匠",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 61,
        "name": "少室山",
        "visualKey": "武侠城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "住持",
        "npcVisualKey": "住持",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 6
      },
      {
        "sourceId": 62,
        "name": "华山",
        "visualKey": "武侠城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "弟子",
        "npcVisualKey": "弟子",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 7
      },
      {
        "sourceId": 63,
        "name": "武当山",
        "visualKey": "武侠城镇3",
        "mapMarkerVisualKey": "0",
        "npcTitle": "长老",
        "npcVisualKey": "长老",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 8
      }
    ]
  },
  {
    "worldIndex": 3,
    "mainCity": {
      "sourceId": 3,
      "name": "燕京",
      "visualKey": "3",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 86,
        "name": "政府",
        "visualKey": "政府",
        "mapMarkerVisualKey": "政府",
        "npcTitle": "工作人员",
        "npcVisualKey": "官员",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 87,
        "name": "潘家园",
        "visualKey": "潘家园",
        "mapMarkerVisualKey": "潘家园",
        "npcTitle": "古董商",
        "npcVisualKey": "古董商",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 88,
        "name": "酒吧",
        "visualKey": "酒吧",
        "mapMarkerVisualKey": "酒吧",
        "npcTitle": "酒吧老板",
        "npcVisualKey": "酒吧老板",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 89,
        "name": "摸金门",
        "visualKey": "摸金门",
        "mapMarkerVisualKey": "摸金门",
        "npcTitle": "侍者",
        "npcVisualKey": "侍者",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 90,
        "name": "锻造厂",
        "visualKey": "锻造厂",
        "mapMarkerVisualKey": "锻造厂",
        "npcTitle": "冶炼工人",
        "npcVisualKey": "工人",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 64,
        "name": "杭州",
        "visualKey": "摸金城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "管事",
        "npcVisualKey": "管事",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 10
      },
      {
        "sourceId": 65,
        "name": "长沙",
        "visualKey": "摸金城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "族长",
        "npcVisualKey": "族长",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 11
      },
      {
        "sourceId": 66,
        "name": "楼兰",
        "visualKey": "摸金城镇3",
        "mapMarkerVisualKey": "0",
        "npcTitle": "老者",
        "npcVisualKey": "老者",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 12
      }
    ]
  },
  {
    "worldIndex": 4,
    "mainCity": {
      "sourceId": 4,
      "name": "耶路撒冷",
      "visualKey": "4",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 91,
        "name": "议会厅",
        "visualKey": "议会厅",
        "mapMarkerVisualKey": "议会厅",
        "npcTitle": "议员",
        "npcVisualKey": "议员",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 92,
        "name": "市场",
        "visualKey": "市场",
        "mapMarkerVisualKey": "市场",
        "npcTitle": "摊贩",
        "npcVisualKey": "摊贩",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 93,
        "name": "征兵处",
        "visualKey": "征兵处",
        "mapMarkerVisualKey": "征兵处",
        "npcTitle": "骑士",
        "npcVisualKey": "骑士",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 94,
        "name": "教廷分部",
        "visualKey": "教廷分部",
        "mapMarkerVisualKey": "教廷分部",
        "npcTitle": "主教",
        "npcVisualKey": "主教",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 95,
        "name": "武器工坊",
        "visualKey": "武器工坊",
        "mapMarkerVisualKey": "武器工坊",
        "npcTitle": "武器工",
        "npcVisualKey": "武器工",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 67,
        "name": "君士坦丁堡",
        "visualKey": "十字城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "骑士",
        "npcVisualKey": "骑士",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 14
      },
      {
        "sourceId": 68,
        "name": "大马士革",
        "visualKey": "十字城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "领袖",
        "npcVisualKey": "领袖",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 15
      }
    ]
  },
  {
    "worldIndex": 5,
    "mainCity": {
      "sourceId": 5,
      "name": "金陵城",
      "visualKey": "5",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 96,
        "name": "城主府",
        "visualKey": "城主府",
        "mapMarkerVisualKey": "城主府",
        "npcTitle": "城主",
        "npcVisualKey": "城主",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 97,
        "name": "市集",
        "visualKey": "市集2",
        "mapMarkerVisualKey": "市集",
        "npcTitle": "小贩",
        "npcVisualKey": "小贩",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 98,
        "name": "客栈",
        "visualKey": "客栈",
        "mapMarkerVisualKey": "客栈",
        "npcTitle": "小二",
        "npcVisualKey": "小二",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 99,
        "name": "法华寺",
        "visualKey": "法华寺",
        "mapMarkerVisualKey": "法华寺",
        "npcTitle": "住持",
        "npcVisualKey": "住持",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 100,
        "name": "锻冶坊",
        "visualKey": "锻冶坊",
        "mapMarkerVisualKey": "锻冶坊",
        "npcTitle": "冶炼工人",
        "npcVisualKey": "铁匠",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 69,
        "name": "幽冥府",
        "visualKey": "聊斋城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "鬼使",
        "npcVisualKey": "鬼使",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 17
      },
      {
        "sourceId": 70,
        "name": "涂山",
        "visualKey": "聊斋城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "狐妖",
        "npcVisualKey": "狐妖",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 18
      }
    ]
  },
  {
    "worldIndex": 6,
    "mainCity": {
      "sourceId": 6,
      "name": "京都",
      "visualKey": "6",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 101,
        "name": "将军府",
        "visualKey": "将军府",
        "mapMarkerVisualKey": "将军府",
        "npcTitle": "将军",
        "npcVisualKey": "部将",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 104,
        "name": "商家",
        "visualKey": "商家",
        "mapMarkerVisualKey": "商家",
        "npcTitle": "商人",
        "npcVisualKey": "商人",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 103,
        "name": "酒馆",
        "visualKey": "酒馆2",
        "mapMarkerVisualKey": "酒馆",
        "npcTitle": "老板娘",
        "npcVisualKey": "老板娘",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 102,
        "name": "道场",
        "visualKey": "道场",
        "mapMarkerVisualKey": "道场",
        "npcTitle": "师范",
        "npcVisualKey": "师范",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 105,
        "name": "匠人宅",
        "visualKey": "匠人宅",
        "mapMarkerVisualKey": "匠人宅",
        "npcTitle": "匠人",
        "npcVisualKey": "匠人",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 71,
        "name": "大阪城",
        "visualKey": "日本城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "部将",
        "npcVisualKey": "部将",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 20
      },
      {
        "sourceId": 72,
        "name": "江户城",
        "visualKey": "日本城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "部将",
        "npcVisualKey": "部将",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 21
      }
    ]
  },
  {
    "worldIndex": 7,
    "mainCity": {
      "sourceId": 7,
      "name": "伦敦",
      "visualKey": "7",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 106,
        "name": "唐宁街",
        "visualKey": "唐宁街",
        "mapMarkerVisualKey": "唐宁街",
        "npcTitle": "行政官",
        "npcVisualKey": "行政官",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 107,
        "name": "物资处",
        "visualKey": "物资处",
        "mapMarkerVisualKey": "物资处",
        "npcTitle": "物资官",
        "npcVisualKey": "物资官",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 108,
        "name": "军事学校",
        "visualKey": "军事学校",
        "mapMarkerVisualKey": "军事学校",
        "npcTitle": "教官",
        "npcVisualKey": "教官",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 109,
        "name": "盟军总部",
        "visualKey": "盟军总部",
        "mapMarkerVisualKey": "盟军总部",
        "npcTitle": "参谋",
        "npcVisualKey": "参谋",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 110,
        "name": "军械局",
        "visualKey": "军械局",
        "mapMarkerVisualKey": "军械局",
        "npcTitle": "工人",
        "npcVisualKey": "工人",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 73,
        "name": "莫斯科",
        "visualKey": "二战城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "上校",
        "npcVisualKey": "上校",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 23
      },
      {
        "sourceId": 74,
        "name": "柏林",
        "visualKey": "二战城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "上校",
        "npcVisualKey": "上校",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 24
      }
    ]
  },
  {
    "worldIndex": 8,
    "mainCity": {
      "sourceId": 8,
      "name": "青云城",
      "visualKey": "8",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 111,
        "name": "仙主府",
        "visualKey": "仙主府",
        "mapMarkerVisualKey": "仙主府",
        "npcTitle": "仙主",
        "npcVisualKey": "仙主",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 112,
        "name": "商会",
        "visualKey": "商会2",
        "mapMarkerVisualKey": "商会2",
        "npcTitle": "商会老板",
        "npcVisualKey": "商会老板",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 113,
        "name": "茶肆",
        "visualKey": "茶肆",
        "mapMarkerVisualKey": "茶肆",
        "npcTitle": "小二",
        "npcVisualKey": "小二",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 114,
        "name": "仙域宗",
        "visualKey": "仙域宗",
        "mapMarkerVisualKey": "仙域宗",
        "npcTitle": "宗门侍者",
        "npcVisualKey": "宗门侍者",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 115,
        "name": "炼化台",
        "visualKey": "炼化台",
        "mapMarkerVisualKey": "炼化台",
        "npcTitle": "炼器师",
        "npcVisualKey": "炼器师",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 75,
        "name": "玄天城",
        "visualKey": "修仙城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "执事",
        "npcVisualKey": "执事",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 26
      },
      {
        "sourceId": 76,
        "name": "雪域城",
        "visualKey": "修仙城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "执事",
        "npcVisualKey": "执事",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 27
      }
    ]
  },
  {
    "worldIndex": 9,
    "mainCity": {
      "sourceId": 9,
      "name": "地球",
      "visualKey": "9",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 116,
        "name": "联盟总部",
        "visualKey": "联盟总部",
        "mapMarkerVisualKey": "联盟总部",
        "npcTitle": "联络官",
        "npcVisualKey": "联络官",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 117,
        "name": "交易中心",
        "visualKey": "交易中心",
        "mapMarkerVisualKey": "交易中心",
        "npcTitle": "交易官",
        "npcVisualKey": "交易官",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 118,
        "name": "克隆中心",
        "visualKey": "克隆中心",
        "mapMarkerVisualKey": "克隆中心",
        "npcTitle": "医生",
        "npcVisualKey": "医生",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 119,
        "name": "战斗中心",
        "visualKey": "战斗中心",
        "mapMarkerVisualKey": "战斗中心",
        "npcTitle": "战斗AI",
        "npcVisualKey": "战斗AI",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 120,
        "name": "锻造中心",
        "visualKey": "锻造中心",
        "mapMarkerVisualKey": "锻造中心",
        "npcTitle": "科学家",
        "npcVisualKey": "科学家",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 77,
        "name": "鲁桑",
        "visualKey": "星战城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "AI",
        "npcVisualKey": "AI",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 29
      },
      {
        "sourceId": 78,
        "name": "莫蒂斯",
        "visualKey": "星战城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "AI",
        "npcVisualKey": "AI",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 30
      }
    ]
  },
  {
    "worldIndex": 10,
    "mainCity": {
      "sourceId": 10,
      "name": "星陨城",
      "visualKey": "10",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 121,
        "name": "帝国机构",
        "visualKey": "帝国机构",
        "mapMarkerVisualKey": "帝国机构",
        "npcTitle": "帝国统领",
        "npcVisualKey": "帝国统领",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 122,
        "name": "商会",
        "visualKey": "商会3",
        "mapMarkerVisualKey": "商会3",
        "npcTitle": "商会老板",
        "npcVisualKey": "商会老板",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 123,
        "name": "酒馆",
        "visualKey": "酒馆3",
        "mapMarkerVisualKey": "酒馆3",
        "npcTitle": "掌柜",
        "npcVisualKey": "掌柜",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 124,
        "name": "落云学院",
        "visualKey": "学院",
        "mapMarkerVisualKey": "学院",
        "npcTitle": "导师",
        "npcVisualKey": "导师",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 125,
        "name": "锻冶坊",
        "visualKey": "锻冶坊",
        "mapMarkerVisualKey": "锻冶坊",
        "npcTitle": "冶炼师",
        "npcVisualKey": "铁匠",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 79,
        "name": "花都城",
        "visualKey": "斗气城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "城主",
        "npcVisualKey": "城主",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 32
      },
      {
        "sourceId": 80,
        "name": "冥影城",
        "visualKey": "斗气城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "城主",
        "npcVisualKey": "城主",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 33
      }
    ]
  },
  {
    "worldIndex": 11,
    "mainCity": {
      "sourceId": 11,
      "name": "达尔然",
      "visualKey": "11",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 137,
        "name": "联盟议会",
        "visualKey": "魔兽城府",
        "mapMarkerVisualKey": "魔兽城府",
        "npcTitle": "议长",
        "npcVisualKey": "议长",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 138,
        "name": "商会",
        "visualKey": "魔兽商会",
        "mapMarkerVisualKey": "魔兽商会",
        "npcTitle": "商会会长",
        "npcVisualKey": "商会会长",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 139,
        "name": "酒馆",
        "visualKey": "魔兽酒馆",
        "mapMarkerVisualKey": "魔兽酒馆",
        "npcTitle": "酒保",
        "npcVisualKey": "酒保",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 140,
        "name": "法师公会",
        "visualKey": "魔兽工会",
        "mapMarkerVisualKey": "魔兽工会",
        "npcTitle": "大法师",
        "npcVisualKey": "大法师",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 141,
        "name": "铁匠铺",
        "visualKey": "魔兽铁匠",
        "mapMarkerVisualKey": "魔兽铁匠",
        "npcTitle": "铁匠大师",
        "npcVisualKey": "铁匠大师",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 152,
        "name": "风暴城",
        "visualKey": "艾泽城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "国王",
        "npcVisualKey": "国王",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 35
      },
      {
        "sourceId": 153,
        "name": "奥瑞玛",
        "visualKey": "艾泽城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "酋长",
        "npcVisualKey": "酋长",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 36
      }
    ]
  },
  {
    "worldIndex": 12,
    "mainCity": {
      "sourceId": 12,
      "name": "纽约",
      "visualKey": "12",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 142,
        "name": "联盟总部",
        "visualKey": "英雄城府",
        "mapMarkerVisualKey": "英雄城府",
        "npcTitle": "秘书长",
        "npcVisualKey": "官员",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 143,
        "name": "斯塔大厦",
        "visualKey": "市政中心",
        "mapMarkerVisualKey": "市政中心",
        "npcTitle": "斯塔职员",
        "npcVisualKey": "行政人员",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 144,
        "name": "神盾局",
        "visualKey": "英雄酒馆",
        "mapMarkerVisualKey": "英雄酒馆",
        "npcTitle": "AI",
        "npcVisualKey": "AI",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 145,
        "name": "至圣所",
        "visualKey": "英雄工会",
        "mapMarkerVisualKey": "英雄工会",
        "npcTitle": "至尊法师",
        "npcVisualKey": "族长",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 146,
        "name": "斯塔工业",
        "visualKey": "英雄铁匠",
        "mapMarkerVisualKey": "英雄铁匠",
        "npcTitle": "科学家",
        "npcVisualKey": "管理员",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 154,
        "name": "暗裔岛",
        "visualKey": "英雄城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "族人",
        "npcVisualKey": "管事",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 38
      },
      {
        "sourceId": 155,
        "name": "变种学院",
        "visualKey": "英雄城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "教授",
        "npcVisualKey": "教授",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 39
      }
    ]
  },
  {
    "worldIndex": 13,
    "mainCity": {
      "sourceId": 13,
      "name": "长安",
      "visualKey": "13",
      "mapMarkerVisualKey": "0",
      "npcTitle": "无",
      "npcVisualKey": "0",
      "dialogueId": 0,
      "functions": []
    },
    "publicLocations": [
      {
        "sourceId": 147,
        "name": "大唐官府",
        "visualKey": "大唐皇宫",
        "mapMarkerVisualKey": "大唐皇宫",
        "npcTitle": "将军",
        "npcVisualKey": "帝国统领",
        "dialogueId": 8,
        "functions": [
          {
            "sourceId": 11,
            "name": "位面总览"
          },
          {
            "sourceId": 35,
            "name": "代理人"
          }
        ]
      },
      {
        "sourceId": 148,
        "name": "商会",
        "visualKey": "大唐商会",
        "mapMarkerVisualKey": "大唐商会",
        "npcTitle": "商会老板",
        "npcVisualKey": "商会老板",
        "dialogueId": 1,
        "functions": [
          {
            "sourceId": 1,
            "name": "购买装备"
          },
          {
            "sourceId": 2,
            "name": "购买道具"
          },
          {
            "sourceId": 4,
            "name": "出售物品"
          }
        ]
      },
      {
        "sourceId": 149,
        "name": "茶肆",
        "visualKey": "茶肆",
        "mapMarkerVisualKey": "茶肆",
        "npcTitle": "小二",
        "npcVisualKey": "小二",
        "dialogueId": 9,
        "functions": [
          {
            "sourceId": 5,
            "name": "招募角色"
          }
        ]
      },
      {
        "sourceId": 150,
        "name": "白马寺",
        "visualKey": "大唐寺庙",
        "mapMarkerVisualKey": "大唐寺庙",
        "npcTitle": "住持",
        "npcVisualKey": "住持",
        "dialogueId": 10,
        "functions": [
          {
            "sourceId": 3,
            "name": "学习技能"
          }
        ]
      },
      {
        "sourceId": 151,
        "name": "铁匠铺",
        "visualKey": "锻冶坊",
        "mapMarkerVisualKey": "锻冶坊",
        "npcTitle": "冶炼师",
        "npcVisualKey": "铁匠",
        "dialogueId": 11,
        "functions": [
          {
            "sourceId": 9,
            "name": "合成锻造"
          }
        ]
      }
    ],
    "factionTowns": [
      {
        "sourceId": 156,
        "name": "火焰山",
        "visualKey": "西游城镇1",
        "mapMarkerVisualKey": "0",
        "npcTitle": "小妖",
        "npcVisualKey": "小妖",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 41
      },
      {
        "sourceId": 157,
        "name": "大雷音寺",
        "visualKey": "西游城镇2",
        "mapMarkerVisualKey": "0",
        "npcTitle": "罗汉",
        "npcVisualKey": "罗汉",
        "dialogueId": 12,
        "functions": [
          {
            "sourceId": 10,
            "name": "阵营任务"
          },
          {
            "sourceId": 3,
            "name": "学习技能"
          },
          {
            "sourceId": 7,
            "name": "贡献兑换"
          },
          {
            "sourceId": 25,
            "name": "势力招募"
          }
        ],
        "factionSourceId": 42
      }
    ]
  }
]

export const ORIGINAL_TOWN_COUNTS = {
  worlds: 13,
  publicLocations: 65,
  factionTowns: 29,
} as const

export const ORIGINAL_CITY_FOUNDATION = {
  gridColumns: 18,
  gridRows: 18,
  buildings: 25,
  technologies: 75,
} as const

export const originalWorldTownByIndex = (worldIndex: number): OriginalWorldTownDefinition | undefined =>
  ORIGINAL_WORLD_TOWNS.find((town) => town.worldIndex === worldIndex)
