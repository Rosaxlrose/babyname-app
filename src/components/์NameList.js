import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBook, faHeart, faChevronDown, faChevronUp, faSearch } from '@fortawesome/free-solid-svg-icons';
import Fuse from 'fuse.js';
import './NameList.css';
import './MatchForm.css';

const NameList = () => {
  const [names, setNames] = useState([]);
  const [filteredNames, setFilteredNames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // Thai vowels to skip for categorization
  const thaiVowels = ['เ', 'แ', 'โ', 'ใ', 'ไ'];

  useEffect(() => {
    fetchNames();
    setupBubbles();
  }, []);

  const setupBubbles = () => {
    const container = document.querySelector('.name-list-container');
    if (container) {
      // Clear existing bubbles
      const existingBubbles = container.querySelectorAll('.name-list-bubble');
      existingBubbles.forEach(bubble => bubble.remove());
      
      // Create new bubbles
      for (let i = 0; i < 6; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'name-list-bubble';
        bubble.style.width = `${Math.random() * 100 + 50}px`;
        bubble.style.height = bubble.style.width;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.top = `${Math.random() * 100}%`;
        bubble.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(bubble);
      }
    }
  };

  useEffect(() => {
    if (names.length > 0) {
      const fuseOptions = {
        keys: ['name', 'meaning', 'tags'],
        threshold: 0.4,
        includeScore: true
      };
      const fuse = new Fuse(names, fuseOptions);

      if (searchTerm) {
        const results = fuse.search(searchTerm);
        setFilteredNames(results.map(result => result.item));
      } else {
        setFilteredNames(names);
      }
    }
  }, [searchTerm, names]);

  const fetchNames = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('names')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching names:', error);
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถดึงข้อมูลชื่อได้ กรุณาลองใหม่อีกครั้ง',
          confirmButtonText: 'ตกลง'
        });
        return;
      }

      if (!data || data.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'ไม่พบข้อมูล',
          text: 'ไม่พบข้อมูลชื่อในระบบ',
          confirmButtonText: 'ตกลง'
        });
        return;
      }

      setNames(data);
      setFilteredNames(data);
      initializeCategories(data);

    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ตกลง'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryChar = (name) => {
    let firstChar = name.charAt(0);
    // Skip Thai vowels
    if (thaiVowels.includes(firstChar)) {
      firstChar = name.charAt(1);
    }
    return firstChar;
  };

  const initializeCategories = (data) => {
    const categories = {};
    data.forEach(name => {
      const category = getCategoryChar(name.name);
      categories[category] = true;
    });
    setExpandedCategories(categories);
  };

  const handleNameClick = (name) => {
    Swal.fire({
      icon: 'info',
      title: name.name,
      html: `
        <div class="text-left">
          <p><strong>ความหมาย:</strong> ${name.meaning}</p>
          <p><strong>แท็ก:</strong> ${name.tags.join(', ')}</p>
          <p><strong>เพศ:</strong> ${name.gender}</p>
        </div>
      `,
      confirmButtonText: 'ปิด'
    });
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const categorizedNames = filteredNames.reduce((acc, name) => {
    const category = getCategoryChar(name.name);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(name);
    return acc;
  }, {});

  return (
    <div className="name-list-container min-h-screen">
      <div className="name-list-glass">
        <h2 className="form-title">
          <span className="star">📖</span>
          รายชื่อทั้งหมด
        </h2>

        <div className="name-list-search">
          <input
            type="text"
            placeholder="ค้นหาชื่อ ความหมาย หรือแท็ก..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <FontAwesomeIcon
            icon={faSearch}
            className="name-list-search-icon"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-lg">กำลังโหลด...</div>
          </div>
        ) : (
          <div className="space-y-8">
          {Object.entries(categorizedNames).sort().map(([category, categoryNames]) => (
            <div key={category} className="bg-white/50 rounded-lg p-4 shadow-sm">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-2 text-xl font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                <span>หมวด {category}</span>
                <FontAwesomeIcon 
                  icon={expandedCategories[category] ? faChevronUp : faChevronDown}
                  className="text-primary/70"
                />
              </button>
              
              {expandedCategories[category] && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {categoryNames.map((name) => (
                    
                    <div
                      key={name.id}
                      onClick={() => handleNameClick(name)}
                      className="name-list-item"
                    >
                      <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <span className="star">
                          {name.gender === 'หญิง' ? '👧' : name.gender === 'ชาย' ? '👦' : '🌟'}
                        </span>
                        {name.name}
                      </h3>
                      <p className="text-gray-600 mb-2 line-clamp-2">{name.meaning}</p>
                      <p className="text-sm text-gray-500 mb-2">เพศ: {name.gender}</p>
                      <div className="flex flex-wrap gap-2">
                        {name.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="name-list-tag"
                          >
                            {tag}
                          </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NameList;