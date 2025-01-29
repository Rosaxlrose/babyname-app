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
  const [filters, setFilters] = useState({
    gender: 'all',
    category: 'all',
    tags: []
  });
  const [allTags, setAllTags] = useState([]);
  const [showAllTags, setShowAllTags] = useState(false);
  const [showTagsFilter, setShowTagsFilter] = useState(false);
  const MAX_VISIBLE_TAGS = 10;

  // ข้ามการใช้สระนำหน้าชื่อ
  const thaiVowels = ['เ', 'แ', 'โ', 'ใ', 'ไ'];

  useEffect(() => {
    fetchNames();
    setupBubbles();
  }, []);

  useEffect(() => {
    if (names.length > 0) {
      // รวบรวมแท็กทั้งหมดที่มีในฐานข้อมูล
      const tags = new Set();
      names.forEach(name => {
        name.tags.forEach(tag => tags.add(tag));
      });
      setAllTags(Array.from(tags).sort());

      // กรองชื่อตามเงื่อนไข
      let filtered = names;

      // กรองตามการค้นหา
      if (searchTerm) {
        const fuseOptions = {
          keys: ['name', 'meaning', 'tags'],
          threshold: 0.4,
          includeScore: true
        };
        const fuse = new Fuse(names, fuseOptions);
        const results = fuse.search(searchTerm);
        filtered = results.map(result => result.item);
      }

      // กรองตามเพศ
      if (filters.gender !== 'all') {
        filtered = filtered.filter(name => name.gender === filters.gender);
      }

      // กรองตามหมวด
      if (filters.category !== 'all') {
        filtered = filtered.filter(name => getCategoryChar(name.name) === filters.category);
      }

      // กรองตามแท็ก
      if (filters.tags.length > 0) {
        filtered = filtered.filter(name => 
          filters.tags.every(tag => name.tags.includes(tag))
        );
      }

      setFilteredNames(filtered);
    }
  }, [searchTerm, names, filters]);

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
          <span className="star">📖 </span>
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

        <div className="filters-row">
          <div className="filter-item">
            <select
              value={filters.gender}
              onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value }))}
              className="form-select"
            >
              <option value="all">เพศ: ทั้งหมด</option>
              <option value="ชาย">เพศ: ชาย</option>
              <option value="หญิง">เพศ: หญิง</option>
              <option value="ใช้ได้กับทั้งสอง">เพศ: ใช้ได้ทั้งสองเพศ</option>
            </select>
          </div>

          <div className="filter-item">
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="form-select"
            >
              <option value="all">หมวด: ทั้งหมด</option>
              {Object.keys(categorizedNames).sort().map(category => (
                <option key={category} value={category}>
                  หมวด: {category}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-item">
            <button 
              onClick={() => setShowTagsFilter(!showTagsFilter)}
              className="filter-toggle-btn"
            >
              <span>แท็ก {filters.tags.length > 0 && `(${filters.tags.length})`}</span>
              <FontAwesomeIcon 
                icon={showTagsFilter ? faChevronUp : faChevronDown}
                className="ml-2"
              />
            </button>
          </div>
        </div>

        {showTagsFilter && (
          <div className="tags-dropdown">
            <div className="tags-container">
              {(showAllTags ? allTags : allTags.slice(0, MAX_VISIBLE_TAGS)).map(tag => (
                <label key={tag} className="tag-checkbox">
                  <input
                    type="checkbox"
                    checked={filters.tags.includes(tag)}
                    onChange={(e) => {
                      setFilters(prev => ({
                        ...prev,
                        tags: e.target.checked
                          ? [...prev.tags, tag]
                          : prev.tags.filter(t => t !== tag)
                      }));
                    }}
                  />
                  <span className="ml-2">{tag}</span>
                </label>
              ))}
              {allTags.length > MAX_VISIBLE_TAGS && (
                <button
                  onClick={() => setShowAllTags(!showAllTags)}
                  className="show-more-tags"
                >
                  {showAllTags ? 'แสดงน้อยลง' : `ดูเพิ่มเติม (${allTags.length - MAX_VISIBLE_TAGS})`}
                </button>
              )}
            </div>
          </div>
        )}

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