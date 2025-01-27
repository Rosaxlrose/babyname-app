import { supabase } from '../supabaseClient';

// Fetch word meanings from database
export const getWordMeanings = async () => {
  const { data, error } = await supabase
    .from('word_meanings')
    .select('*');
    
  if (error) throw error;
  return data || [];
};

// Get related meanings for a word
export const getRelatedMeanings = async (word) => {
  const { data: exactMatch } = await supabase
    .from('word_meanings')
    .select('meaning')
    .eq('word', word);

  const { data: similarMatch } = await supabase
    .from('word_meanings')
    .select('meaning')
    .ilike('meaning', `%${word}%`);
    
  const meanings = [...(exactMatch || []), ...(similarMatch || [])];
  return meanings.map(d => d.meaning);
};

// Add new training data
export const addTrainingData = async (input, output, confidence) => {
    console.log('บันทึกข้อมูลการเทรน:', { input, output, confidence });
    
    try {
      const { error } = await supabase
        .from('training_data')
        .insert([{
          input_text: input,
          output_text: output, 
          confidence_score: confidence
        }]);
        
      if (error) {
        console.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล:', error);
        throw error;
      }
      
      console.log('บันทึกข้อมูลสำเร็จ');
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล:', error);
      throw error;
    }
  };

// Enhance search with word relationships
export const enhanceSearchTerms = async (searchTerm) => {
  const wordMeanings = await getWordMeanings();
  const relatedTerms = new Set([searchTerm]);
  
  // Find related words based on meanings and categories
  for (const { word, meaning, category } of wordMeanings) {
    if (meaning.includes(searchTerm) || 
        word.includes(searchTerm) || 
        category.includes(searchTerm)) {
      relatedTerms.add(word);
      relatedTerms.add(category);
      meaning.split(' ').forEach(term => relatedTerms.add(term));
    }
  }
  
  return Array.from(relatedTerms);
};

// Update the existing suggestNamesWithAI function to use enhanced search
export const enhancedSuggestNamesWithAI = async (preferences, parentTags, existingNames) => {
  try {
    // แยกคำค้นหาและหาคำที่เกี่ยวข้อง
    const searchTerms = preferences.split(',').map(term => term.trim());
    const allEnhancedTerms = await Promise.all(
      searchTerms.map(term => enhanceSearchTerms(term))
    );
    
    // รวมคำที่เกี่ยวข้องทั้งหมด
    const enhancedPreferences = [...new Set(allEnhancedTerms.flat())].join(' ');
    
    // ค้นหาชื่อที่มี tag หรือความหมายตรงกับคำที่เกี่ยวข้อง
    const matchedNames = existingNames.filter(name => {
      const nameTags = name.tags.join(' ').toLowerCase();
      const nameMeaning = name.meaning.toLowerCase();
      return enhancedPreferences.toLowerCase().split(' ').some(term => 
        nameTags.includes(term) || nameMeaning.includes(term)
      );
    });
    
    // บันทึกข้อมูลการเทรน
    await addTrainingData(
      preferences,
      enhancedPreferences,
      matchedNames.length > 0 ? 0.8 : 0.2
    );
    
    return matchedNames;
  } catch (error) {
    console.error('Error in enhanced name suggestion:', error);
    return [];
  }
};