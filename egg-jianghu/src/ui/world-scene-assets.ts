import world01 from '../assets/worlds/world_01.webp'
import world02 from '../assets/worlds/world_02.webp'
import world03 from '../assets/worlds/world_03.webp'
import world04 from '../assets/worlds/world_04.webp'
import world05 from '../assets/worlds/world_05.webp'
import world06 from '../assets/worlds/world_06.webp'
import world07 from '../assets/worlds/world_07.webp'
import world08 from '../assets/worlds/world_08.webp'
import world09 from '../assets/worlds/world_09.webp'
import world10 from '../assets/worlds/world_10.webp'

const worldScenes: Record<string, string> = {
  world_01: world01,
  world_02: world02,
  world_03: world03,
  world_04: world04,
  world_05: world05,
  world_06: world06,
  world_07: world07,
  world_08: world08,
  world_09: world09,
  world_10: world10,
}

// 仅已开放的十卷有场景图；未开放卷返回 null，界面保持纯文字卡样式
export const worldSceneAsset = (worldId: string): string | null => worldScenes[worldId] ?? null
