// nameDecisionTree.js
import { supabase } from '../supabaseClient';

// ฟังก์ชันสำหรับคำนวณความคล้ายคลึงของข้อความ
const calculateStringSimilarity = (str1, str2) => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // ใช้ Levenshtein distance algorithm
    const matrix = Array(s2.length + 1).fill().map(() => Array(s1.length + 1).fill(0));
    
    for (let i = 0; i <= s1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= s2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= s2.length; j++) {
        for (let i = 1; i <= s1.length; i++) {
            const substitutionCost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,
                matrix[j - 1][i] + 1,
                matrix[j - 1][i - 1] + substitutionCost
            );
        }
    }
    
    // คำนวณความคล้ายคลึงเป็นเปอร์เซ็นต์
    const maxLength = Math.max(s1.length, s2.length);
    return 1 - (matrix[s2.length][s1.length] / maxLength);
};

// ฟังก์ชันคำนวณคะแนนตามเงื่อนไขต่างๆ
const calculateScore = (name, preferences, parentTags = []) => {
    let score = 7; // คะแนนเริ่มต้น
    let hasMatch = false;

    // แปลงข้อมูลเป็น Set เพื่อเพิ่มประสิทธิภาพ
    const prefSet = new Set(preferences.toLowerCase().split(',').map(p => p.trim()));
    const parentTagSet = new Set(parentTags.map(t => t.toLowerCase()));
    const nameTagSet = new Set(name.tags.map(t => t.toLowerCase()));

    // ตรวจสอบ tags ของพ่อแม่
    for (const tag of nameTagSet) {
        if (parentTagSet.has(tag)) {
            score += 2;
            hasMatch = true;
        }
    }

    // ตรวจสอบความชอบใน tags
    for (const tag of nameTagSet) {
        if (prefSet.has(tag)) {
            score += 2;
            hasMatch = true;
        }
    }

    // ตรวจสอบความชอบในความหมาย
    const meaningWords = name.meaning.toLowerCase().split(/[\s,]+/);
    for (const pref of prefSet) {
        if (meaningWords.some(word => word.includes(pref))) {
            score += 3;
            hasMatch = true;
        }
    }

    return hasMatch ? score : null;
};

// ฟังก์ชันแนะนำชื่อตามความหมาย
export const recommendNames = (preferences, names) => {
    if (!preferences || !names?.length) return [];

    // Decision Tree สำหรับการแนะนำชื่อ
    const recommendationTree = (name) => {
        // 1. ตรวจสอบความคล้ายคลึงของความหมาย
        const meaningScore = calculateStringSimilarity(name.meaning, preferences);
        
        // 2. ตรวจสอบ tags ที่ตรงกับความต้องการ
        const prefWords = preferences.toLowerCase().split(/[\s,]+/);
        const tagMatch = name.tags.some(tag => 
            prefWords.some(pref => tag.toLowerCase().includes(pref))
        );

        // 3. คำนวณคะแนนรวม
        let score = 0;
        if (meaningScore > 0.6) score += 7;  // ความหมายคล้ายมาก
        else if (meaningScore > 0.3) score += 5;  // ความหมายคล้ายปานกลาง
        if (tagMatch) score += 3;  // มี tag ตรงกับความต้องการ

        return score > 0 ? { ...name, score: Math.min(15, score) } : null;
    };

    // กรองและเรียงลำดับผลลัพธ์
    return names
        .map(recommendationTree)
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);
};

// ฟังก์ชันจับคู่ชื่อ
export const matchNames = (name, type, names) => {
    if (!name || !names?.length) return [];

    // Decision Tree สำหรับการจับคู่ชื่อ
    const matchingTree = (candidateName) => {
        // 1. ตรวจสอบว่าเป็นชื่อเดียวกันหรือไม่
        if (candidateName.name.toLowerCase() === name.toLowerCase()) {
            return null;
        }

        // 2. ตรวจสอบตามประเภทการจับคู่
        if (type === 'twins') {
            // 2.1 กรณีชื่อแฝด ต้องขึ้นต้นด้วยตัวอักษรเดียวกัน
            if (candidateName.name[0].toLowerCase() !== name[0].toLowerCase()) {
                return null;
            }

            // 2.2 ความยาวของชื่อต้องใกล้เคียงกัน (ต่างกันไม่เกิน 2 ตัวอักษร)
            if (Math.abs(candidateName.name.length - name.length) > 2) {
                return null;
            }

            // 2.3 ต้องมีเพศเดียวกัน
            const nameObj = names.find(n => n.name.toLowerCase() === name.toLowerCase());
            if (nameObj && nameObj.gender !== candidateName.gender) {
                return null;
            }
        } else {
            // 2.4 กรณีชื่อพี่น้อง ความยาวต่างกันได้ไม่เกิน 3 ตัวอักษร
            if (Math.abs(candidateName.name.length - name.length) > 3) {
                return null;
            }
        }

        // 3. คำนวณความคล้ายคลึง
        const similarity = calculateStringSimilarity(candidateName.name, name);
        
        // 4. คำนวณคะแนน
        let score = 0;
        if (type === 'twins') {
            // กรณีชื่อแฝด ต้องมีความคล้ายคลึงมากกว่า 0.4
            if (similarity > 0.4) {
                score = Math.round(10 + (similarity * 5));
            } else {
                return null;
            }

            // เพิ่มคะแนนถ้ามี tags ตรงกัน
            const nameObj = names.find(n => n.name.toLowerCase() === name.toLowerCase());
            if (nameObj) {
                const commonTags = nameObj.tags.filter(tag => 
                    candidateName.tags.includes(tag)
                );
                score += commonTags.length * 2;
            }
        } else {
            // กรณีชื่อพี่น้อง ต้องมีความคล้ายคลึงมากกว่า 0.3
            if (similarity > 0.3) {
                score = Math.round(7 + (similarity * 8));
            } else {
                return null;
            }

            // เพิ่มคะแนนถ้ามี tags ตรงกัน
            const nameObj = names.find(n => n.name.toLowerCase() === name.toLowerCase());
            if (nameObj) {
                const commonTags = nameObj.tags.filter(tag => 
                    candidateName.tags.includes(tag)
                );
                score += commonTags.length;
            }
        }

        // 5. ตรวจสอบคะแนนขั้นต่ำ
        const minScore = type === 'twins' ? 12 : 10;
        if (score < minScore) {
            return null;
        }

        return { ...candidateName, score: Math.min(15, Math.round(score)) };
    };

    // กรองและเรียงลำดับผลลัพธ์
    const matches = names
        .map(matchingTree)
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

    // จำกัดจำนวนผลลัพธ์
    const maxResults = type === 'twins' ? 5 : 8;
    return matches.slice(0, maxResults);
};

// ฟังก์ชันแนะนำชื่อตามเงื่อนไขต่างๆ
export const suggestNamesWithTree = (preferences, parentTags, allNames) => {
    if (!allNames?.length) return [];

    // แยกความชอบเป็นคำๆ
    const preferenceWords = preferences
        ? preferences.split(',').map(word => word.trim()).filter(Boolean)
        : [];

    // ถ้าไม่มีเงื่อนไขใดๆ
    if (!preferenceWords.length && !parentTags.length) return [];

    // กรณีมีแค่ความชอบ
    const onlyPreferences = preferenceWords.length > 0 && !parentTags.length;

    // Decision Tree สำหรับการแนะนำชื่อ
    const suggestionTree = (name) => {
        if (onlyPreferences) {
            // ตรวจสอบการตรงกับความชอบ
            const hasMatch = preferenceWords.some(pref => {
                const prefLower = pref.toLowerCase();
                return name.tags.some(tag => tag.toLowerCase().includes(prefLower)) ||
                       name.meaning.toLowerCase().includes(prefLower);
            });
            return hasMatch ? { ...name, score: null } : null;
        }

        // คำนวณคะแนนตามเงื่อนไข
        const score = calculateScore(name, preferences, parentTags);
        return score ? { ...name, score } : null;
    };

    // ประมวลผลและเรียงลำดับ
    const results = allNames
        .map(suggestionTree)
        .filter(Boolean);

    if (onlyPreferences) return results;

    // เรียงลำดับตามคะแนน
    const sortedResults = results.sort((a, b) => b.score - a.score);

    // กรองชื่อตามเกณฑ์คะแนน
    const highScoreNames = sortedResults.filter(name => name.score >= 10);
    if (highScoreNames.length > 0) return highScoreNames;

    // ถ้าไม่มีชื่อที่คะแนนมากกว่า 10 ให้ใช้คะแนนสูงสุดที่มี
    const maxScore = sortedResults[0]?.score;
    return sortedResults.filter(name => name.score === maxScore);
};

// ฟังก์ชันเพิ่มชื่อใหม่
export const addNewName = async (nameData) => {
    try {
        const { data: existingName } = await supabase
            .from('names')
            .select('name')
            .eq('name', nameData.name)
            .single();

        if (existingName) {
            throw new Error('ชื่อนี้มีอยู่ในระบบแล้ว');
        }

        const { data, error } = await supabase
            .from('names')
            .insert([nameData])
            .select();

        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error adding new name:', error);
        throw error;
    }
};
