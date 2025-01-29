import { pipeline } from '@huggingface/transformers';
import Fuse from 'fuse.js';
import { supabase } from '../supabaseClient';
import * as tf from '@tensorflow/tfjs';

// Cache for trained models
const modelCache = new Map();
const MODEL_CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

const textToVector = (text, length) => {
    if (!text) return new Array(length).fill(0);
    const truncatedText = text.slice(0, length);
    const vector = new Array(length).fill(0);
    
    for (let i = 0; i < truncatedText.length; i++) {
        vector[i] = truncatedText.charCodeAt(i) % 256;
    }
    return vector;
};

const getModelFromCache = (cacheKey) => {
    const cached = modelCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MODEL_CACHE_DURATION) {
        return cached.model;
    }
    modelCache.delete(cacheKey);
    return null;
};

const trainNameModel = async (existingNames) => {
    try {
        const cacheKey = JSON.stringify(existingNames.map(n => n.id).sort());
        const cachedModel = getModelFromCache(cacheKey);
        if (cachedModel) {
            return cachedModel;
        }

        const inputSize = 50;
        const outputSize = 50;
        
        const trainingData = existingNames.map(name => ({
            input: [
                ...textToVector(name.meaning, 25),
                ...name.tags.slice(0, 2).map(tag => textToVector(tag, 12)).flat()
            ],
            output: textToVector(name.name, outputSize)
        }));

        const model = tf.sequential();
        model.add(tf.layers.dense({ 
            units: 64,
            activation: 'relu', 
            inputShape: [inputSize] 
        }));
        model.add(tf.layers.dropout(0.2));
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dropout(0.1));
        model.add(tf.layers.dense({ units: outputSize }));

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'meanSquaredError'
        });

        const xs = tf.tensor2d(trainingData.map(d => {
            const input = d.input;
            while (input.length < inputSize) input.push(0);
            return input.slice(0, inputSize);
        }));
        
        const ys = tf.tensor2d(trainingData.map(d => {
            const output = d.output;
            while (output.length < outputSize) output.push(0);
            return output.slice(0, outputSize);
        }));

        await model.fit(xs, ys, {
            epochs: 30,
            batchSize: 32,
            shuffle: true,
            validationSplit: 0.1
        });

        modelCache.set(cacheKey, {
            model,
            timestamp: Date.now()
        });

        return model;
    } catch (error) {
        console.error('Error in trainNameModel:', error);
        throw error;
    }
};

const normalizeScore = (score, max) => {
    if (max === 0) return 7; // Default middle score
    return Math.round((score / max) * 15);
};

const calculateNameScore = (name, predictedVector) => {
    const nameVector = textToVector(name.name + ' ' + name.meaning, 50);
    return tf.tidy(() => {
        const similarity = tf.tensor1d(nameVector)
            .dot(tf.tensor1d(predictedVector))
            .dataSync()[0];
        return similarity * 10; // Scale to 0-10
    });
};

const calculateBasicScore = (name, preferences, parentTags) => {
    let score = 7; // คะแนนเริ่มต้น
    
    if (!preferences?.trim() && (!parentTags || parentTags.length === 0)) {
        return score;
    }

    // ให้คะแนนตาม tags ที่ตรงกับพ่อแม่
    if (parentTags?.length > 0) {
        name.tags.forEach(tag => {
            if (parentTags.includes(tag)) {
                score += 2;
            }
        });
    }

    // ให้คะแนนตามความชอบและความหมาย
    if (preferences?.trim()) {
        const prefsLower = preferences.toLowerCase();
        const meaningLower = name.meaning.toLowerCase();
        const tagsLower = name.tags.map(t => t.toLowerCase());
        
        // แยกคำจากความชอบ
        const prefWords = prefsLower.split(/[,\s]+/).filter(Boolean);
        
        prefWords.forEach(pref => {
            // ตรวจสอบใน tags
            if (tagsLower.some(tag => tag.includes(pref))) {
                score += 2;
            }
            
            // ตรวจสอบในความหมาย
            if (meaningLower.includes(pref)) {
                score += 3;
            }
        });
    }

    return Math.min(15, score);
};

// Optimized Fuse instance creation with caching
const fuseInstanceCache = new Map();
const FUSE_CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

const getFuseInstance = (names) => {
    const cacheKey = JSON.stringify(names.map(n => n.id).sort());
    const cached = fuseInstanceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FUSE_CACHE_DURATION) {
        return cached.fuse;
    }

    const fuse = new Fuse(names, {
        keys: ['name', 'meaning', 'tags'],
        threshold: 0.4,
        includeScore: true,
        useExtendedSearch: true
    });

    fuseInstanceCache.set(cacheKey, {
        fuse,
        timestamp: Date.now()
    });

    return fuse;
};

export const suggestNamesWithAI = async (preferences, parentTags, allNames) => {
    // แยกความชอบเป็นคำๆ และกำจัดช่องว่าง
    const preferenceWords = preferences
        ? preferences.split(',').map(word => word.trim().toLowerCase()).filter(Boolean)
        : [];

    // ถ้าไม่มีเงื่อนไขใดๆ ให้คืนค่าว่าง
    if (preferenceWords.length === 0 && parentTags.length === 0) {
        return [];
    }

    // ถ้ามีแค่ความชอบ/ความหมาย ไม่ต้องคำนวณคะแนน
    const onlyPreferences = preferenceWords.length > 0 && parentTags.length === 0;

    // ใช้ Set เพื่อเพิ่มความเร็วในการค้นหา
    const preferenceSet = new Set(preferenceWords);
    const parentTagSet = new Set(parentTags);

    // คำนวณคะแนนทุกชื่อพร้อมกัน
    const scoredNames = allNames.map(name => {
        if (onlyPreferences) {
            // ถ้ามีแค่ความชอบ ให้ตรวจสอบแค่ว่าตรงกับความชอบหรือไม่
            const nameTags = new Set(name.tags.map(tag => tag.toLowerCase()));
            const meaningWords = name.meaning.toLowerCase().split(/[\s,]+/);
            
            const hasMatchingPreference = preferenceWords.some(pref => 
                nameTags.has(pref) || meaningWords.some(word => word.includes(pref))
            );

            // ส่งคืนชื่อที่ตรงกับความชอบ พร้อมคะแนน null
            return hasMatchingPreference ? { ...name, score: null } : null;
        } else {
            // คำนวณคะแนนตามปกติ
            let score = 7; // คะแนนเริ่มต้น
            let hasMatch = false;

            // ตรวจสอบ tags ของพ่อแม่
            const nameTags = new Set(name.tags.map(tag => tag.toLowerCase()));
            for (const tag of nameTags) {
                if (parentTagSet.has(tag)) {
                    score += 2;
                    hasMatch = true;
                }
            }

            // ตรวจสอบความชอบใน tags
            for (const tag of nameTags) {
                if (preferenceSet.has(tag)) {
                    score += 2;
                    hasMatch = true;
                }
            }

            // ตรวจสอบความชอบในความหมาย
            const meaningWords = name.meaning.toLowerCase().split(/[\s,]+/);
            for (const pref of preferenceSet) {
                if (meaningWords.some(word => word.includes(pref))) {
                    score += 3;
                    hasMatch = true;
                }
            }

            // คืนค่า null ถ้าไม่มีการตรงกับเงื่อนไขใดๆ
            return hasMatch ? { ...name, score } : null;
        }
    }).filter(Boolean); // กรองเอาแค่ชื่อที่ไม่เป็น null

    // ถ้าไม่มีชื่อที่ตรงเงื่อนไข
    if (scoredNames.length === 0) {
        return [];
    }

    // กรณีมีแค่ความชอบ ส่งคืนทุกชื่อที่ตรงกับความชอบ
    if (onlyPreferences) {
        return scoredNames;
    }

    // เรียงลำดับตามคะแนน
    const sortedNames = scoredNames.sort((a, b) => b.score - a.score);

    // หาชื่อที่มีคะแนนมากกว่า 10
    const highScoreNames = sortedNames.filter(name => name.score >= 10);

    // ถ้ามีชื่อที่คะแนนมากกว่า 10 ให้แสดงเฉพาะชื่อเหล่านั้น
    if (highScoreNames.length > 0) {
        return highScoreNames;
    }

    // ถ้าไม่มีชื่อที่คะแนนมากกว่า 10 ให้หาคะแนนสูงสุด
    const maxScore = sortedNames[0].score;
    
    // แสดงชื่อที่มีคะแนนเท่ากับคะแนนสูงสุด
    return sortedNames.filter(name => name.score === maxScore);
};

export const recommendNames = async (preferences, names) => {
    if (!preferences || !names || names.length === 0) {
        return [];
    }

    try {
        const fuse = getFuseInstance(names);
        const results = fuse.search(preferences);
        return results.map(result => ({
            ...result.item,
            score: normalizeScore(1 - result.score, 1)
        }));
    } catch (error) {
        console.error('Error recommending names:', error);
        throw error;
    }
};

export const matchNames = async (name, type, names) => {
    if (!name || !names || names.length === 0) {
        return [];
    }

    try {
        const fuse = getFuseInstance(names);
        const results = fuse.search(name);
        
        return results
            .filter(result => {
                if (!result.item.name) return false;
                if (result.item.name.toLowerCase() === name.toLowerCase()) {
                    return false;
                }
                
                if (type === 'twins') {
                    return result.item.name[0].toLowerCase() === name[0].toLowerCase();
                }
                return true;
            })
            .map(result => ({
                ...result.item,
                score: normalizeScore(1 - result.score, 1)
            }));
    } catch (error) {
        console.error('Error matching names:', error);
        throw error;
    }
};

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