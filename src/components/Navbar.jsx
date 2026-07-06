import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-pink-600">
          Careers Connect
        </Link>
        <div className="flex gap-4">
          <Link to="/" className="text-gray-600 hover:text-pink-600 transition">
            Home
          </Link>
          <Link to="/apply" className="text-gray-600 hover:text-pink-600 transition">
            Apply
          </Link>
        </div>
      </div>
    </nav>
  )
}
