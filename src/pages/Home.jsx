import { Link } from 'react-router-dom'
import { POSITIONS, SITE } from '../config'

export default function Home() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-pink-50 to-purple-50 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium mb-6">
            Now Recruiting
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Join Our Team
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            {POSITIONS.length} positions are open right now.
          </p>
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            Read about each role below, then send us your details and two short videos.
            Applications are open to everyone.
          </p>
          <a
            href="#positions"
            className="inline-block px-8 py-3 bg-pink-600 text-white rounded-lg text-lg font-medium hover:bg-pink-700 transition shadow-lg"
          >
            {SITE.ctaButtonLabel}
          </a>
        </div>
      </section>

      <section id="positions" className="py-16 bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-3">Open Positions</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Each application is for one position. You can apply again for the other role if
            you are interested in both.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {POSITIONS.map((position) => (
              <article
                key={position.id}
                className="flex flex-col border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition"
              >
                <span className="inline-block self-start px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-xs font-medium mb-4">
                  {position.tagline}
                </span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{position.title}</h3>
                <p className="text-gray-600 mb-4">{position.summary}</p>
                <p className="text-gray-500 text-sm mb-5">{position.description}</p>

                <h4 className="font-semibold text-gray-900 text-sm mb-2">
                  What you will do
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-600 mb-5">
                  {position.responsibilities.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-pink-500 mt-0.5">&#8226;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <h4 className="font-semibold text-gray-900 text-sm mb-2">
                  What we are looking for
                </h4>
                <ul className="space-y-1.5 text-sm text-gray-600 mb-6">
                  {position.requirements.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-pink-500 mt-0.5">&#8226;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to={`/apply?position=${position.id}`}
                  className="mt-auto block text-center px-6 py-3 bg-pink-600 text-white rounded-lg font-medium hover:bg-pink-700 transition"
                >
                  Apply for {position.title}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">Application Process</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {SITE.processSteps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {step.number}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">Video Guidelines</h2>
          <div className="bg-gray-50 rounded-xl shadow-sm p-8">
            <ul className="space-y-4 text-gray-600">
              {SITE.videoGuidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="text-pink-500 mt-1">&#8226;</span>
                  <span>
                    <strong>{guideline.strong}</strong> {guideline.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 bg-pink-600 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">{SITE.ctaHeading}</h2>
          <p className="text-pink-100 mb-8">{SITE.ctaDescription}</p>
          <Link
            to="/apply"
            className="inline-block px-8 py-3 bg-white text-pink-600 rounded-lg text-lg font-medium hover:bg-pink-50 transition"
          >
            {SITE.ctaButtonLabel}
          </Link>
        </div>
      </section>
    </div>
  )
}
