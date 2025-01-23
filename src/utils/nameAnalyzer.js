import { supabase } from '../supabaseClient';
import * as tf from '@tensorflow/tfjs';

class NameAnalyzer {
    constructor() {
        this.model = null;
        this.tokenizer = null;
        this.initialized = false;
        this.commonTags = [
            'มงคล', 'ความสุข', 'ความสำเร็จ', 'ปัญญา', 'ความดี',
            'ความรัก', 'ความเมตตา', 'ความมั่งคั่ง', 'ความกล้าหาญ'
        ];
    }

    // วิเคราะห์ความหมายของชื่อเชิงลึก
    async analyzeNameMeaning(name) {
        try {
            // ดึงข้อมูลชื่อจาก Supabase
            const { data: nameData, error: nameError } = await supabase
                .from('names')
                .select('*')
                .eq('name', name)
                .limit(1);

            if (nameError) throw nameError;
            if (!nameData || nameData.length === 0) {
                throw new Error('ไม่พบชื่อนี้ในฐานข้อมูล');
            }

            const meaning = nameData[0].meaning;
            
            // วิเคราะห์ความหมายด้วย rule-based
            const analysis = {
                primaryMeaning: meaning,
                categories: nameData[0].tags || [],
                characteristics: [],
                culturalContext: [],
                recommendations: []
            };

            // วิเคราะห์ลักษณะเด่น
            if (meaning.includes('ความสุข') || meaning.includes('รอยยิ้ม')) {
                analysis.characteristics.push('มีความสุข', 'ร่าเริง');
            }
            if (meaning.includes('ปัญญา') || meaning.includes('ความรู้')) {
                analysis.characteristics.push('ฉลาด', 'มีไหวพริบ');
            }
            if (meaning.includes('ความดี') || meaning.includes('คุณธรรม')) {
                analysis.characteristics.push('มีคุณธรรม', 'จิตใจดี');
            }

            // วิเคราะห์บริบททางวัฒนธรรม
            if (meaning.includes('พระ') || meaning.includes('เทพ')) {
                analysis.culturalContext.push('เกี่ยวข้องกับศาสนา');
            }
            if (meaning.includes('กษัตริย์') || meaning.includes('ราช')) {
                analysis.culturalContext.push('เกี่ยวข้องกับราชวงศ์');
            }

            // เพิ่มคำแนะนำ
            if (analysis.characteristics.length > 0) {
                analysis.recommendations.push(
                    'ชื่อนี้สื่อถึงลักษณะที่ดี เหมาะสำหรับการตั้งชื่อเด็ก'
                );
            }
            if (analysis.culturalContext.length > 0) {
                analysis.recommendations.push(
                    'ชื่อนี้มีความเชื่อมโยงกับวัฒนธรรมไทย'
                );
            }

            return analysis;
        } catch (error) {
            console.error('Error analyzing name meaning:', error);
            throw error;
        }
    }

    // แนะนำชื่อตามความต้องการ
    async recommendNames(preferences) {
        try {
            const { desiredMeaning, characteristics, gender } = preferences;

            // ดึงข้อมูลชื่อทั้งหมด
            let query = supabase
                .from('names')
                .select('*');

            // กรองตามเพศ (ถ้ามี)
            if (gender) {
                query = query.eq('gender', gender);
            }

            const { data: names, error } = await query;

            if (error) throw error;
            if (!names || names.length === 0) {
                throw new Error('ไม่พบชื่อที่ตรงตามเงื่อนไข');
            }

            // คำนวณคะแนนความเหมาะสม
            const scoredNames = names.map(name => {
                let score = 0;

                // ให้คะแนนตามความหมาย
                if (name.meaning.toLowerCase().includes(desiredMeaning.toLowerCase())) {
                    score += 3;
                }

                // ให้คะแนนตาม tags
                if (characteristics && characteristics.length > 0) {
                    characteristics.forEach(char => {
                        if (name.tags && name.tags.includes(char)) {
                            score += 2;
                        }
                    });
                }

                return { ...name, score };
            });

            // เรียงลำดับและเลือก 5 อันดับแรก
            return scoredNames
                .filter(n => n.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);
        } catch (error) {
            console.error('Error recommending names:', error);
            throw error;
        }
    }

    // จับคู่ชื่อสำหรับฝาแฝดหรือพี่น้อง
    async findMatchingNames(name, type = 'twins') {
        try {
            // ดึงข้อมูลชื่อต้นฉบับ
            const { data: baseNameData, error: baseError } = await supabase
                .from('names')
                .select('*')
                .eq('name', name)
                .limit(1);

            if (baseError) throw baseError;
            if (!baseNameData || baseNameData.length === 0) {
                throw new Error('ไม่พบชื่อต้นฉบับในฐานข้อมูล');
            }

            const baseName = baseNameData[0];

            // ดึงชื่อทั้งหมด
            const { data: names, error } = await supabase
                .from('names')
                .select('*');

            if (error) throw error;
            if (!names || names.length === 0) {
                throw new Error('ไม่พบข้อมูลชื่อในฐานข้อมูล');
            }

            // คำนวณความเข้ากัน
            const matchedNames = names
                .filter(n => n.name !== name) // กรองชื่อต้นฉบับออก
                .map(candidate => {
                    let score = 0;

                    // ตรวจสอบความคล้ายคลึงของความหมาย
                    if (baseName.tags && candidate.tags) {
                        baseName.tags.forEach(tag => {
                            if (candidate.tags.includes(tag)) {
                                score += 2;
                            }
                        });
                    }

                    // สำหรับฝาแฝด
                    if (type === 'twins') {
                        if (candidate.name[0] === baseName.name[0]) {
                            score += 3; // ชื่อขึ้นต้นด้วยตัวอักษรเดียวกัน
                        }
                        if (candidate.tags && baseName.tags && 
                            candidate.tags.length === baseName.tags.length) {
                            score += 2;
                        }
                    }

                    // สำหรับพี่น้อง
                    if (type === 'siblings') {
                        if (candidate.tags && baseName.tags && 
                            candidate.tags.some(tag => baseName.tags.includes(tag))) {
                            score += 1;
                        }
                    }

                    return { ...candidate, matchScore: score };
                });

            // เรียงลำดับและเลือก 5 อันดับแรก
            const results = matchedNames
                .filter(n => n.matchScore > 0)
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, 5);

            if (results.length === 0) {
                throw new Error('ไม่พบชื่อที่เข้ากัน');
            }

            return results;
        } catch (error) {
            console.error('Error finding matching names:', error);
            throw error;
        }
    }
}

export const nameAnalyzer = new NameAnalyzer();

export const analyzeName = (name, preferences) => {
    let score = 0;

    // วิเคราะห์ความหมาย
    if (name.meaning.toLowerCase().includes(preferences.toLowerCase())) {
        score += 5; // คะแนนเต็มถ้าตรง
    } else if (name.meaning.toLowerCase().includes(preferences.toLowerCase().split(',')[0].trim())) {
        score += 2; // คะแนนบางส่วนถ้าตรงบางส่วน
    }

    // วิเคราะห์แท็ก
    if (score < 10) { // ตรวจสอบว่าคะแนนยังไม่ถึง 10
        name.tags.forEach(tag => {
            if (tag.toLowerCase().includes(preferences.toLowerCase())) {
                score += 5; // คะแนนจากแท็ก
            }
        });
    }

    return Math.min(score, 10); // ทำให้คะแนนไม่เกิน 10
};

const atmosphereMapping = {
    "บรรยากาศสบายๆ": ["ความสงบ", "ทะเล", "แม่น้ำ"],
    "ร้อน": ["ทะเล", "ชายหาด", "น้ำแข็ง"],
    "เย็น": ["ภูเขา", "หิมะ", "ความสงบ"]
};

const analyzeAtmosphere = (input) => {
    const lowerInput = input.toLowerCase();
    return atmosphereMapping[lowerInput] || [];
};

const analyzePreferences = (preferences, names, parentTags) => {
    const prefs = preferences.toLowerCase().split(',').map(p => p.trim());
    const scoredNames = names.map(name => {
        let score = 0;

        // ให้คะแนนตามแท็กของพ่อแม่ (สูงสุด 4 คะแนน)
        if (parentTags.size > 0) {
            name.tags.forEach(tag => {
                if (parentTags.has(tag)) {
                    score += 2;
                }
            });
        }

        // ให้คะแนนตามความชอบ/ความหมายที่ต้องการ
        prefs.forEach(pref => {
            // ตรวจสอบความหมายตรงกัน
            if (name.meaning.toLowerCase().includes(pref)) {
                score += 3;
            }
            // ตรวจสอบแท็กตรงกัน
            name.tags.forEach(tag => {
                if (tag.toLowerCase().includes(pref)) {
                    score += 1.5;
                }
            });
        });
       
        return { ...name, score: Math.min(score, 10) };
    });

    // เลือกชื่อที่มีคะแนนมากกว่า 0
    const topNames = scoredNames
        .filter(n => n.score > 0)
        .sort((a, b) => b.score - a.score);

    return topNames;
};

export { analyzePreferences };
