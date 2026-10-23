import { Link } from 'react-router-dom'
import { PRIVACY_POLICY } from '../privacy'

export default function Privacy() {
  const policy = PRIVACY_POLICY

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-xl shadow-sm p-6 md:p-10">
          <h1 className="text-3xl font-bold mb-2">{policy.title}</h1>
          <p className="text-sm text-gray-500 mb-6">
            Version {policy.version} · Effective {policy.effectiveDate}
          </p>

          <p className="text-gray-700 leading-relaxed mb-8">{policy.intro}</p>

          {policy.sections.map((section) => (
            <section key={section.heading} className="mb-8">
              <h2 className="text-xl font-semibold mb-3">{section.heading}</h2>

              {section.paragraphs?.map((text, i) => (
                <p key={i} className="text-gray-700 leading-relaxed mb-3">
                  {text}
                </p>
              ))}

              {section.list && (
                <ul className="list-disc pl-6 space-y-2 text-gray-700">
                  {section.list.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}

              {section.footnotes?.map((text, i) => (
                <p key={i} className="text-gray-500 text-sm mt-3">
                  {text}
                </p>
              ))}
            </section>
          ))}

          <div className="pt-6 border-t">
            <Link to="/apply" className="text-pink-600 font-medium hover:underline">
              ← Back to the application
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
