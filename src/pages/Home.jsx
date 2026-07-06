import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-br from-pink-50 to-purple-50 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium mb-6">
            Now Recruiting
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Podcast Host
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            This position is open exclusively to female applicants.
          </p>
          <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
            We are looking for a charismatic and confident female Podcast Host
            to be the face and voice of our show. If you love being in front
            of the camera and connecting with audiences, we want to hear from
            you.
          </p>
          <Link
            to="/apply"
            className="inline-block px-8 py-3 bg-pink-600 text-white rounded-lg text-lg font-medium hover:bg-pink-700 transition shadow-lg"
          >
            Apply Now
          </Link>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-center mb-12">
            Application Process
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Personal Information</h3>
              <p className="text-gray-500 text-sm">
                Fill in your details so we can get to know you.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">English Video</h3>
              <p className="text-gray-500 text-sm">
                Record a video in English introducing yourself and why you want
                to be our Podcast Host.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">French Video</h3>
              <p className="text-gray-500 text-sm">
                Record a second video in French covering the same content.
              </p>
            </div>
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
              <li className="flex items-start gap-3">
                <span className="text-pink-500 mt-1">&#8226;</span>
                <span>
                  <strong>Introduce yourself</strong> &mdash; Tell us your name,
                  background, and what makes you a great host.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-pink-500 mt-1">&#8226;</span>
                <span>
                  <strong>Why this position?</strong> &mdash; Explain why you
                  want to be our Podcast Host and what excites you about it.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-pink-500 mt-1">&#8226;</span>
                <span>
                  <strong>Why us?</strong> &mdash; Share why you want to work
                  with us and how you will shine on camera.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-pink-500 mt-1">&#8226;</span>
                <span>
                  <strong>Keep it under 3 minutes</strong> per video.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-pink-500 mt-1">&#8226;</span>
                <span>
                  <strong>File size limit:</strong> 100MB per video (MP4, MOV,
                  or WebM format).
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 bg-pink-600 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to Apply?</h2>
          <p className="text-pink-100 mb-8">
            Take the first step toward becoming our next Podcast Host.
          </p>
          <Link
            to="/apply"
            className="inline-block px-8 py-3 bg-white text-pink-600 rounded-lg text-lg font-medium hover:bg-pink-50 transition"
          >
            Start Your Application
          </Link>
        </div>
      </section>
    </div>
  )
}
