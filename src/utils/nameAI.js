import Fuse from 'fuse.js';
import { supabase } from '../supabaseClient';
import * as tf from '@tensorflow/tfjs';

// แคชสำหรับเก็บข้อมูล
const modelCache = new Map();
const MODEL_CACHE_DURATION = 1000 * 60 * 30; // 30 นาที

// แปลงข้อความเป็นเวกเตอร์
const textToVector = (text, length) => {
    if (!text) return new Array(length).fill(0);
    const truncatedText = text.slice(0, length);
    const vector = new Array(length).fill(0);

    for (let i = 0; i < truncatedText.length; i++) {
        vector[i] = truncatedText.charCodeAt(i) % 256;
    }
    return vector;
};

// ดึงโมเดลจากแคช
const getModelFromCache = (cacheKey) => {
    const cached = modelCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < MODEL_CACHE_DURATION) {
        return cached.model;
    }
    modelCache.delete(cacheKey);
    return null;
};

// เทรนโมเดล Neural Network
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
        model.add(tf.layers.dense({ units: 64, activation: 'relu', inputShape: [inputSize] }));
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

        modelCache.set(cacheKey, { model, timestamp: Date.now() });

        return model;
    } catch (error) {
        console.error('Error in trainNameModel:', error);
        throw error;
    }
};

// คำนวณคะแนนพื้นฐาน
const calculateBaseScore = (name, preferences, parentTags) => {
    let score = 7;

    if (parentTags?.length > 0) {
        const parentMatches = name.tags.filter(tag => parentTags.includes(tag)).length;
        score += parentMatches * 3;  // เพิ่มน้ำหนักของ parentTags
    }

    if (preferences?.trim()) {
        const prefWords = preferences.toLowerCase().split(/[,\s]+/).filter(Boolean);
        const meaningMatches = prefWords.filter(word => name.meaning.toLowerCase().includes(word)).length;
        const tagMatches = prefWords.filter(word => name.tags.some(tag => tag.toLowerCase().includes(word))).length;

        score += Math.min(2, meaningMatches + tagMatches);  // ลด max preference bonus
    }

    return Math.min(15, Math.max(5, score));
};

// ฟังก์ชันหลักสำหรับแนะนำชื่อ
export const suggestNamesWithAI = async (preferences, parentTags, allNames) => {
    const fuse = new Fuse(allNames, {
        keys: ['name', 'meaning', 'tags'],
        threshold: 0.3, // ลด threshold เพื่อเพิ่มความแม่นยำ
        includeScore: true,
        useExtendedSearch: true,
        getFn: (obj, path) => (path === 'tags' ? obj.tags.join(' ') : obj[path])
    });

    const preferenceWords = preferences
        ? preferences.split(',').map(word => word.trim().toLowerCase()).filter(Boolean)
        : [];

    let model = null;
    if (preferenceWords.length > 0) {
        try {
            model = await trainNameModel(allNames);
        } catch (error) {
            console.warn('Model training failed:', error);
        }
    }

    const fuseResults = fuse.search(preferenceWords.join(' | '));
    const fuseMap = {};
    fuseResults.forEach(result => {
        const normalizedScore = Math.max(5, Math.min(10, (1 - result.score) * 10));
        fuseMap[result.item.name] = { item: result.item, fuseScore: Math.round(normalizedScore) };
    });

    let matches = allNames.map(name => ({
        ...name,
        fuseScore: fuseMap[name.name]?.fuseScore ?? 7
    }));

    const scoredNames = await Promise.all(matches.map(async match => {
        const baseScore = calculateBaseScore(match, preferences, parentTags);

        let aiScore = 7;
        if (model) {
            try {
                const inputVector = [
                    ...textToVector(match.meaning, 25),
                    ...match.tags.slice(0, 2).map(tag => textToVector(tag, 12)).flat()
                ];
                while (inputVector.length < 50) inputVector.push(0);

                const prediction = tf.tidy(() => {
                    const input = tf.tensor2d([inputVector]);
                    return model.predict(input).dataSync();
                });

                const similarity = tf.tidy(() => {
                    const nameVector = textToVector(match.name + ' ' + match.meaning, 50);
                    return tf.tensor1d(nameVector).dot(tf.tensor1d(Array.from(prediction))).dataSync()[0];
                });

                aiScore = Math.max(5, Math.min(10, Math.round(5 + (similarity * 5))));
            } catch (error) {
                console.warn('Error calculating AI score:', error);
            }
        }

        const finalScore = Math.round(
            (baseScore * 0.6) +  
            (match.fuseScore * 0.2) +  
            (aiScore * 0.2)  
        );

        return {
            ...match,
            score: Math.min(15, Math.max(5, finalScore)),
            matchDetails: {
                baseScore,
                fuseScore: match.fuseScore,
                aiScore,
                finalScore
            }
        };
    }));

    return scoredNames
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map(name => ({ ...name, score: Math.round(name.score) }));
};


// เพิ่มชื่อใหม่เข้าระบบ
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

        const { data, error } = await supabase.from('names').insert([nameData]).select();

        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('Error adding new name:', error);
        throw error;
    }
};
