import { padCount } from '../lib/status'
import { questionPriorityMeta, type OpenQuestion, type QuestionPriority } from '../data/research'
import { sectionMeta, type SectionId, type SectionMeta } from '../data/sections'

/** 优先级从高到低的展示顺序。 */
const priorityOrder: QuestionPriority[] = ['blocker', 'important', 'normal']

type Props = {
  section: SectionMeta
  questions: OpenQuestion[]
  onGoToSection: (id: SectionId) => void
}

export default function QuestionsPanel({ section, questions, onGoToSection }: Props) {
  return (
    <div className="questions-section">
      <div className="mechanics-heading">
        <div>
          <p className="kicker">{section.eyebrow}</p>
          <h2>{section.label}</h2>
        </div>
        <p>公开资料足够帮助我们搭底座，但以下内容不能直接当作当前版本的硬编码规则。</p>
      </div>

      {priorityOrder.map((priority) => {
        const group = questions.filter((question) => question.priority === priority)
        if (group.length === 0) return null

        const meta = questionPriorityMeta[priority]

        return (
          <section className="question-group" key={priority}>
            <div className="group-heading">
              <span>
                {meta.label} · {meta.note}
              </span>
              <small>{padCount(group.length)}</small>
            </div>
            <div className="question-grid">
              {group.map((question) => {
                const scope = sectionMeta.find((item) => item.id === question.scope)

                return (
                  <article className="question-card" key={question.id}>
                    <span className={`priority-chip priority-${question.priority}`}>{meta.label}</span>
                    <p>{question.question}</p>
                    {scope && (
                      <button className="scope-link" type="button" onClick={() => onGoToSection(scope.id)}>
                        <span>{scope.label}</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
