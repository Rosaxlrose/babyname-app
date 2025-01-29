import { supabase } from '../supabaseClient';
import Fuse from 'fuse.js';

// ใช้แคชข้อมูลใน Local Storage เพื่อลดการดึงข้อมูลซ้ำ
const getWordMeaningsFromCache = () => {
  return JSON.parse(localStorage.getItem('word_meanings_cache')) || [];
};

const setWordMeaningsToCache = (data) => {
  localStorage.setItem('word_meanings_cache', JSON.stringify(data));
};

// ดึงข้อมูลความหมายของคำแบบมีประสิทธิภาพ
export const getWordMeanings = async (fromOffset = 0, limit = 100) => {
  let wordMeanings = getWordMeaningsFromCache();
  if (!wordMeanings.length) {
    const { data, error } = await supabase
      .from('word_meanings')
      .select('word, meaning') // ดึงเฉพาะคอลัมน์ที่จำเป็น
      .range(fromOffset, fromOffset + limit - 1);
    if (error) throw error;
    wordMeanings = data;
    setWordMeaningsToCache(wordMeanings); // เก็บในแคช
  }
  return wordMeanings;
};

// ฟังก์ชันค้นหาความหมายคำแบบละเอียด
export const getRelatedMeanings = async (word) => {
  const { data, error } = await supabase
    .from('word_meanings')
    .select('meaning')
    .or(`word.ilike.%${word}%,meaning.ilike.%${word}%`) // ใช้การค้นหาแบบ or
    .limit(50); // จำกัดจำนวนผลลัพธ์
  if (error) throw error;
  return data.map(d => d.meaning);
};

// Cache for word meanings
const meaningCache = new Map();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

// Cache for enhanced terms
const enhancedTermsCache = new Map();

const getMeaningFromCache = (word) => {
    const cached = meaningCache.get(word);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.meaning;
    }
    meaningCache.delete(word);
    return null;
};

const addMeaningToCache = (word, meaning) => {
    meaningCache.set(word, {
        meaning,
        timestamp: Date.now()
    });
};

// คำที่มักจะใช้ด้วยกัน (Collocations)
const commonCollocations = new Map([
    ['ความสุข', ['สดใส', 'รุ่งเรือง', 'เบิกบาน', 'สมหวัง', 'สำเร็จ']],
    ['ความสำเร็จ', ['รุ่งเรือง', 'ก้าวหน้า', 'มั่งคั่ง', 'มั่นคง']],
    ['มงคล', ['เจริญ', 'รุ่งเรือง', 'ดี', 'สิริ']],
    ['เจริญ', ['รุ่งเรือง', 'ก้าวหน้า', 'มั่นคง']],
    ['รุ่งเรือง', ['เจริญ', 'ก้าวหน้า', 'มั่งคั่ง']],
    ['สิริ', ['มงคล', 'ดี', 'เจริญ']],
    ['ดี', ['เจริญ', 'มงคล', 'สุข']],
]);

export const enhanceSearchTerms = async (searchTerms) => {
    if (!searchTerms?.trim()) return [];

    const cacheKey = searchTerms.toLowerCase();
    const cached = enhancedTermsCache.get(cacheKey);
    if (cached) return cached;

    const terms = searchTerms.toLowerCase().split(/[,\s]+/).filter(Boolean);
    const enhancedTerms = new Set(terms);

    // เพิ่มคำที่มักจะใช้ด้วยกัน
    terms.forEach(term => {
        const collocations = commonCollocations.get(term);
        if (collocations) {
            collocations.forEach(word => enhancedTerms.add(word));
        }
    });

    // ดึงความหมายจาก cache หรือ database
    const meanings = await Promise.all(
        terms.map(async term => {
            let meaning = getMeaningFromCache(term);
            if (!meaning) {
                const { data, error } = await supabase
                    .from('word_meanings')
                    .select('meaning')
                    .eq('word', term)
                    .single();

                if (!error && data) {
                    meaning = data.meaning;
                    addMeaningToCache(term, meaning);
                }
            }
            return meaning;
        })
    );

    // เพิ่มคำที่เกี่ยวข้องจากความหมาย
    meanings.filter(Boolean).forEach(meaning => {
        const relatedWords = meaning.toLowerCase().split(/[,\s]+/).filter(Boolean);
        relatedWords.forEach(word => enhancedTerms.add(word));
    });

    const result = Array.from(enhancedTerms);
    enhancedTermsCache.set(cacheKey, result);
    return result;
};

export const addTrainingData = async (originalTerms, enhancedTerms, confidence) => {
    try {
        const { data, error } = await supabase
            .from('training_data')
            .insert([{
                original_terms: originalTerms,
                enhanced_terms: enhancedTerms,
                confidence
            }]);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error adding training data:', error);
        return null;
    }
};

// ค้นหาคำที่เกี่ยวข้องด้วย Fuse.js แบบเพิ่มประสิทธิภาพ
export const enhanceSearchTermsWithFuse = async (searchTerm) => {
  const wordMeanings = await getWordMeanings(0, 500); // จำกัดข้อมูลเพื่อความเร็ว
  const fuse = new Fuse(wordMeanings, {
    keys: ['word', 'meaning'],
    threshold: 0.4, // ปรับ threshold ให้ค้นหาได้เร็วขึ้น
    includeScore: false, // ลดการประมวลผลคะแนน
  });
  const result = fuse.search(searchTerm);
  const relatedTerms = new Set([searchTerm, ...result.map(({ item }) => item.word)]);
  return Array.from(relatedTerms);
};

// ฟังก์ชัน suggestNamesWithAI ที่ปรับปรุงประสิทธิภาพ
export const enhancedSuggestNamesWithAI = async (
  preferences, 
  parentTags, 
  existingNames, 
  currentPage = 1, 
  pageSize = 20
) => {
  try {
    const searchTerms = preferences.split(',').map(term => term.trim());
    const allEnhancedTerms = await Promise.all(
      searchTerms.map(term => enhanceSearchTerms(term))
    );

    const enhancedPreferences = [...new Set(allEnhancedTerms.flat())];
    const matchedNames = existingNames
      .filter(name => {
        const nameTags = name.tags.join(' ').toLowerCase();
        const nameMeaning = name.meaning.toLowerCase();
        return enhancedPreferences.some(term =>
          nameTags.includes(term) || nameMeaning.includes(term)
        );
      })
      .slice((currentPage - 1) * pageSize, currentPage * pageSize); // ใช้การ pagination

    await addTrainingData(
      preferences,
      enhancedPreferences.join(' '),
      matchedNames.length > 0 ? 0.9 : 0.1 // เพิ่มคะแนนความมั่นใจ
    );

    return matchedNames;
  } catch (error) {
    console.error(error);
    return [];
  }
};
