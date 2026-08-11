import { useSyncExternalStore } from 'react'
import { sectionMeta, type SectionId } from '../data/sections'
import { researchSubjects } from '../data/subjects'

export type Route = {
  subjectId: string
  sectionId: SectionId
}

/** 解析 `#/subject/section`，任一段非法时兜底到首项。 */
function parseHash(hash: string): Route {
  const [rawSubject = '', rawSection = ''] = hash.replace(/^#\/?/, '').split('/')

  return {
    subjectId: researchSubjects.some((subject) => subject.id === rawSubject)
      ? rawSubject
      : researchSubjects[0].id,
    sectionId: sectionMeta.some((section) => section.id === rawSection)
      ? (rawSection as SectionId)
      : sectionMeta[0].id,
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** getSnapshot 必须返回原始字符串：返回新建对象会让 React 判定持续变化。 */
function getHashSnapshot() {
  return window.location.hash
}

export type Navigate = (next: Partial<Route>) => void

export function useHashRoute(): [Route, Navigate] {
  const hash = useSyncExternalStore(subscribe, getHashSnapshot, () => '')
  const route = parseHash(hash)

  const navigate: Navigate = (next) => {
    const subjectId = next.subjectId ?? route.subjectId
    const sectionId = next.sectionId ?? route.sectionId
    window.location.hash = `/${subjectId}/${sectionId}`
  }

  return [route, navigate]
}
