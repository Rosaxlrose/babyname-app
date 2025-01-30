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
    let matchCount = 0; // นับจำนวนการแมตช์
    
    if (!preferences?.trim() && (!parentTags || parentTags.length === 0)) {
        return { score: 7, matchCount: 0 };
    }

    // ให้คะแนนตาม tags ที่ตรงกับพ่อแม่
    if (parentTags?.length > 0) {
        name.tags.forEach(tag => {
            if (parentTags.includes(tag)) {
                score += 2;
                matchCount++;
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
                matchCount++;
            }
            
            // ตรวจสอบในความหมาย
            if (meaningLower.includes(pref)) {
                score += 3;
                matchCount++;
            }
        });
    }

    // ปรับคะแนนตามจำนวนการแมตช์
    const normalizedScore = Math.min(15, Math.max(7, score - (matchCount === 0 ? 7 : 0)));
    
    return { score: normalizedScore, matchCount };
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

    // เริ่มการเทรนโมเดลแบบ async
    let modelPromise;
    if (preferenceWords.length > 0) {
        modelPromise = trainNameModel(allNames).catch(err => {
            console.warn('Model training failed, falling back to basic scoring:', err);
            return null;
        });
    }

    // คำนวณคะแนนทุกชื่อพร้อมกัน
    const scoredNames = await Promise.all(allNames.map(async name => {
        // คำนวณคะแนนพื้นฐาน
        const { score: basicScore, matchCount } = calculateBasicScore(name, preferences, parentTags);
        
        // ถ้าไม่มีการแมตช์เลย ไม่ต้องรวมในผลลัพธ์
        if (matchCount === 0 && basicScore <= 7) {
            return null;
        }

        let finalScore = basicScore;

        // เพิ่มคะแนนจากโมเดล AI ถ้ามี
        try {
            const model = await modelPromise;
            if (model) {
                const inputVector = [
                    ...textToVector(name.meaning, 25),
                    ...name.tags.slice(0, 2).map(tag => textToVector(tag, 12)).flat()
                ];
                while (inputVector.length < 50) inputVector.push(0);

                const prediction = tf.tidy(() => {
                    const input = tf.tensor2d([inputVector]);
                    const output = model.predict(input);
                    return output.dataSync();
                });

                const aiScore = calculateNameScore(name, Array.from(prediction));
                // ผสมคะแนน AI กับคะแนนพื้นฐาน (70% คะแนนพื้นฐาน, 30% คะแนน AI)
                finalScore = Math.round((basicScore * 0.7) + (aiScore * 0.3));
            }
        } catch (error) {
            console.warn('Error calculating AI score:', error);
            // ถ้าเกิดข้อผิดพลาด ใช้คะแนนพื้นฐานอย่างเดียว
        }

        return { ...name, score: Math.min(15, Math.max(7, finalScore)) };
    }));

    // กรองเอาแค่ชื่อที่ไม่เป็น null และมีคะแนนมากกว่า 7
    const validNames = scoredNames.filter(name => name && name.score > 8);

    // ถ้าไม่มีชื่อที่เหมาะสม
    if (validNames.length === 0) {
        return [];
    }

    // เรียงลำดับตามคะแนน
    return validNames.sort((a, b) => b.score - a.score);
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