import TopBar from './components/TopBar'
import SubjectTabs from './components/SubjectTabs'
import SectionTabs from './components/SectionTabs'
import AttributePanel from './components/AttributePanel'
import MechanismPanel from './components/MechanismPanel'
import QuestionsPanel from './components/QuestionsPanel'
import ProjectNoteBand from './components/ProjectNoteBand'
import { tabId, tabPanelId } from './components/TabList'
import { useHashRoute } from './hooks/useHashRoute'
import { researchSubjects } from './data/subjects'
import { isAttributeSection, sectionMeta } from './data/sections'

/** 派生 tab / tabpanel id 的命名空间，两级各一个。 */
const SUBJECT_SCOPE = 'subject'
const SECTION_SCOPE = 'section'

function App() {
  const [route, navigate] = useHashRoute()

  // parseHash 已兜底非法值，这里的 ?? 只为满足 find 的可空返回类型
  const subject = researchSubjects.find((item) => item.id === route.subjectId) ?? researchSubjects[0]
  const section = sectionMeta.find((item) => item.id === route.sectionId) ?? sectionMeta[0]

  return (
    <div className="app-shell">
      <TopBar subject={subject} />

      <main>
        <div className="tab-stack">
          <SubjectTabs
            activeId={subject.id}
            onSelect={(subjectId) => navigate({ subjectId })}
            panelId={SUBJECT_SCOPE}
          />

          <div
            className="subject-panel"
            role="tabpanel"
            id={tabPanelId(SUBJECT_SCOPE, subject.id)}
            aria-labelledby={tabId(SUBJECT_SCOPE, subject.id)}
          >
            <SectionTabs
              subject={subject}
              activeId={section.id}
              onSelect={(sectionId) => navigate({ sectionId })}
              panelId={SECTION_SCOPE}
            />

            <div
              className="tabpanel"
              role="tabpanel"
              id={tabPanelId(SECTION_SCOPE, section.id)}
              aria-labelledby={tabId(SECTION_SCOPE, section.id)}
              tabIndex={0}
            >
              {isAttributeSection(section.id) ? (
                // key 触发 remount，切 Tab 时 search / selectedId 自动重置
                <AttributePanel
                  key={`${subject.id}:${section.id}`}
                  subject={subject}
                  sectionId={section.id}
                />
              ) : section.id === 'mechanics' ? (
                <MechanismPanel section={section} notes={subject.mechanismNotes} />
              ) : (
                <QuestionsPanel
                  section={section}
                  questions={subject.openQuestions}
                  onGoToSection={(sectionId) => navigate({ sectionId })}
                />
              )}
            </div>
          </div>
        </div>

        <ProjectNoteBand />
      </main>

      <footer className="site-footer">
        <span>GAME DESIGN LAB / FOUNDATION BUILD</span>
        <span>数据是策划输入，不是客户端真值</span>
      </footer>
    </div>
  )
}

export default App
