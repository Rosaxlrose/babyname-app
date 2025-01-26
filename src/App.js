import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import MatchForm from './components/MatchForm';
import NameList from './components/์NameList';
import AINameAnalysis from './components/AINameAnalysis';
import TeamSection from './components/TeamSection';
import { Menu, X } from 'lucide-react';

function App() {
  const [isNavOpen, setIsNavOpen] = useState(false);

  const navLinks = [
    { to: "/", text: "หน้าหลัก 🏠" },
    { to: "/list", text: "รายชื่อ 📃" },
    { to: "/analysis", text: "AI แนะนำชื่อ 🤖" },
    { to: "/team", text: "ทีม 👥" }
  ];

  const NavLinks = () => (
    <>
      {navLinks.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="block py-2 px-4 text-gray-500 hover:text-custom-blue transition-colors duration-200"
          onClick={() => setIsNavOpen(false)}
        >
          {link.text}
        </Link>
      ))}
    </>
  );

  return (
    <Router>
    
        <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <span className="font-semibold text-logo-custom text-lg">
                Baby Name 👶
              </span>

              {/* Desktop Navigation */}
              <div className="hidden md:flex md:items-center md:space-x-4">
                <NavLinks />
              </div>

              {/* Mobile Navigation Button */}
              <button
                className="md:hidden p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
                onClick={() => setIsNavOpen(!isNavOpen)}
                aria-label="Toggle menu"
              >
                {isNavOpen ? (
                  <X className="h-6 w-6 text-gray-500" />
                ) : (
                  <Menu className="h-6 w-6 text-gray-500" />
                )}
              </button>
            </div>

            {/* Mobile Navigation Menu */}
            {isNavOpen && (
              <div className="md:hidden py-2 border-t border-gray-100">
                <NavLinks />
              </div>
            )}
          </div>
        </nav>

        <div className="container mx-auto py-8 px-4 mt-16">
          <Routes>
            <Route path="/" element={<MatchForm />} />
            <Route path="/list" element={<NameList />} />
            <Route path="/analysis" element={<AINameAnalysis />} />
            <Route path="/team" element={<TeamSection />} />
          </Routes>
        </div>
    
    </Router>
  );
}

export default App;