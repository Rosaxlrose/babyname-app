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

// เพิ่มข้อมูลการเทรน (ไม่มีการเปลี่ยนแปลง)
export const addTrainingData = async (input, output, confidence) => {
  const { error } = await supabase
    .from('training_data')
    .insert([{
      input_text: input,
      output_text: output,
      confidence_score: confidence
    }]);
  if (error) throw error;
};

// ค้นหาคำที่เกี่ยวข้องด้วย Fuse.js แบบเพิ่มประสิทธิภาพ
export const enhanceSearchTerms = async (searchTerm) => {
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
