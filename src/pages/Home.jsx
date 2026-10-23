import { Link } from 'react-router-dom'
import { JOB } from '../config'

export default function Home() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-pink-50 to-purple-50 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium mb-6">
            {JOB.tagline}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {JOB.title}
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            {JOB.description}
          </p>
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            {JOB.details}
          </p>
          <Link
            to="/apply"
            className="inline-block px-8 py-3 bg-pink-600 text-white rounded-lg text-lg font-medium hover:bg-pink-700 transition shadow-lg"
          >
            {JOB.applyButtonLabel}
          </Link>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">
            Application Process
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {JOB.processSteps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {step.number}
                </div>
                <h3 className="font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-500 text-sm">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-8">
            Video Guidelines
          </h2>
          <div className="bg-white rounded-xl shadow-sm p-8">
            <ul className="space-y-4 text-gray-600">
              {JOB.videoGuidelines.map((guideline, index) => (
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
          <h2 className="text-3xl font-bold mb-4">{JOB.ctaHeading}</h2>
          <p className="text-pink-100 mb-8">{JOB.ctaDescription}</p>
          <Link
            to="/apply"
            className="inline-block px-8 py-3 bg-white text-pink-600 rounded-lg text-lg font-medium hover:bg-pink-50 transition"
          >
            {JOB.ctaButtonLabel}
          </Link>
        </div>
      </section>
    </div>
  )
}
