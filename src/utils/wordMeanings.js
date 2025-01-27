import { supabase } from '../supabaseClient';
import Fuse from 'fuse.js'; // Import Fuse.js

// ใช้แคชข้อมูลใน Local Storage
const getWordMeaningsFromCache = () => {
  return JSON.parse(localStorage.getItem('word_meanings_cache')) || [];
};

const setWordMeaningsToCache = (data) => {
  localStorage.setItem('word_meanings_cache', JSON.stringify(data));
};

export const getWordMeanings = async (fromOffset = 0, limit = 100) => {
  let wordMeanings = getWordMeaningsFromCache();
  if (!wordMeanings.length) {
    const { data, error } = await supabase
      .from('word_meanings')
      .select('*')
      .range(fromOffset, fromOffset + limit - 1); // ใช้การ pagination
    if (error) throw error;
    wordMeanings = data;
    setWordMeaningsToCache(wordMeanings);
  }
  return wordMeanings.slice(fromOffset, fromOffset + limit);
};

// ดึงข้อมูลความหมายที่เกี่ยวข้องกับคำที่ค้นหา
export const getRelatedMeanings = async (word) => {
  const { data: exactMatch } = await supabase
    .from('word_meanings')
    .select('meaning')
    .eq('word', word);
    
  const { data: similarMatch } = await supabase
    .from('word_meanings')
    .select('meaning')
    .ilike('meaning', `%${word}%`)
    .limit(50); 

  const meanings = [...(exactMatch || []), ...(similarMatch || [])];
  return meanings.map(d => d.meaning);
};

// เพิ่มข้อมูลการเทรน
export const addTrainingData = async (input, output, confidence) => {
  try {
    const { error } = await supabase
      .from('training_data')
      .insert([{
        input_text: input,
        output_text: output, 
        confidence_score: confidence
      }]);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
};

// ปรับปรุงการค้นหาด้วยการหาคำที่เกี่ยวข้องและใช้ Fuse.js
export const enhanceSearchTerms = async (searchTerm) => {
  const wordMeanings = await getWordMeanings();
  const options = {
    keys: [
      'word',
      'meaning',
      'category'
    ],
    threshold: 0.3 // Set threshold for fuzzy matching
  };
  const fuse = new Fuse(wordMeanings, options);
  const result = fuse.search(searchTerm);
  const relatedTerms = new Set([searchTerm, ...result.map(({ item }) => item.word)]);

  return Array.from(relatedTerms);
};

// อัปเดตฟังก์ชัน suggestNamesWithAI 
export const enhancedSuggestNamesWithAI = async (preferences, parentTags, existingNames, currentPage = 1, pageSize = 20) => {
  try {
    const searchTerms = preferences.split(',').map(term => term.trim());
    const allEnhancedTerms = await Promise.all(
      searchTerms.map(term => enhanceSearchTerms(term))
    );

    const enhancedPreferences = [...new Set(allEnhancedTerms.flat())].join(' ');
    const matchedNames = existingNames
      .filter(name => {
        const nameTags = name.tags.join(' ').toLowerCase();
        const nameMeaning = name.meaning.toLowerCase();
        return enhancedPreferences.toLowerCase().split(' ').some(term => 
          nameTags.includes(term) || nameMeaning.includes(term)
        );
      }).slice((currentPage - 1) * pageSize, currentPage * pageSize); // ใช้การ pagination

    await addTrainingData(
      preferences,
      enhancedPreferences,
      matchedNames.length > 0 ? 0.8 : 0.2
    );

    return matchedNames;
  } catch (error) {
    return [];
  }
};
