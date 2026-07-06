export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-300 py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} Careers Connect. All rights reserved.
        </p>
        <p className="text-xs mt-1 text-gray-500">
          Committed to empowering women in the workplace.
        </p>
      </div>
    </footer>
  )
}
