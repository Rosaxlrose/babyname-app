import { pipeline } from '@huggingface/transformers';
import Fuse from 'fuse.js';
import { supabase } from '../supabaseClient';
import * as tf from '@tensorflow/tfjs';

const textToVector = (text, length) => {
    const truncatedText = text.slice(0, length);
    const vector = new Array(length).fill(0);
    
    for (let i = 0; i < truncatedText.length; i++) {
        vector[i] = truncatedText.charCodeAt(i) % 256;
    }
    return vector;
};

const trainNameModel = async (existingNames) => {
    try {
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
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
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
            epochs: 50,
            batchSize: 32,
            shuffle: true
        });

        return model;
    } catch (error) {
        console.error('Error in trainNameModel:', error);
        throw error;
    }
};

const normalizeScore = (score, max) => {
  return Math.round((score / max) * 15); 
};

const calculateNameScore = (name, predictedVector) => {
  const nameVector = textToVector(name.name, 50);
  let score = 0;
  const minLength = Math.min(nameVector.length, predictedVector.length);
  
  for (let i = 0; i < minLength; i++) {
      score += Math.abs(nameVector[i] - predictedVector[i]);
  }
  const aiScore = 1 / (1 + score / 1000);
  return normalizeScore(aiScore, 1); // แปลงให้เป็น 0-15
};


const calculateBasicScore = (name, preferences, parentTags) => {
  let score = 0;
  const prefs = preferences.toLowerCase().split(',').map(p => p.trim());
  
  // คำนวณคะแนนสูงสุดที่เป็นไปได้
  const maxPossibleScore = (parentTags.length * 2) + (prefs.length * 5); // 2 points per parent tag + 5 points per preference

  // ให้คะแนนตามแท็กของพ่อแม่
  parentTags.forEach(tag => {
      if (name.tags.includes(tag)) score += 2;
  });

  // ให้คะแนนตามความชอบ
  prefs.forEach(pref => {
      if (name.meaning.toLowerCase().includes(pref)) score += 3;
      name.tags.forEach(tag => {
          if (tag.toLowerCase().includes(pref)) score += 2;
      });
  });

  // ถ้าไม่มีเกณฑ์ในการให้คะแนน ให้คะแนนพื้นฐาน 7 (ครึ่งหนึ่งของ 15)
  if (maxPossibleScore === 0) return 7;

  return normalizeScore(score, maxPossibleScore);
};


// สร้าง Fuse instance สำหรับการค้นหาแบบ fuzzy
const createFuseInstance = (names) => {
    return new Fuse(names, {
        keys: ['name', 'meaning', 'tags'],
        threshold: 0.4,
        includeScore: true
    });
};

export const suggestNamesWithAI = async (preferences, parentTags, existingNames) => {
  try {
      if (!preferences || !existingNames || existingNames.length === 0) {
          return [];
      }

      const model = await trainNameModel(existingNames);
      
      const inputVector = [
          ...textToVector(preferences, 25),
          ...parentTags.slice(0, 2).map(tag => textToVector(tag, 12)).flat()
      ];

      while (inputVector.length < 50) inputVector.push(0);

      const prediction = model.predict(tf.tensor2d([inputVector.slice(0, 50)]));
      const predictedVector = await prediction.array();

      const suggestedNames = existingNames.map(name => {
          const aiScore = calculateNameScore(name, predictedVector[0]);
          const basicScore = calculateBasicScore(name, preferences, parentTags);
          
          // ใช้ค่าเฉลี่ยถ่วงน้ำหนักระหว่าง AI score และ basic score
          const weightedScore = (aiScore * 0.4) + (basicScore * 0.6);
          
          return {
              ...name,
              score: Math.min(15, Math.round(weightedScore)) // จำกัดคะแนนสูงสุดที่ 15
          };
      });

      return suggestedNames.sort((a, b) => b.score - a.score);
  } catch (error) {
      console.error('Error in AI name suggestion:', error);
      // ถ้า AI ล้มเหลว ใช้ basic score อย่างเดียว
      return existingNames.map(name => ({
          ...name,
          score: calculateBasicScore(name, preferences, parentTags)
      })).sort((a, b) => b.score - a.score);
  }
};

export const recommendNames = async (preferences, names) => {
  try {
      const fuse = createFuseInstance(names);
      const results = fuse.search(preferences);
      return results.map(result => ({
          ...result.item,
          score: normalizeScore(1 - result.score, 1) // แปลง fuzzy score (0-1) เป็น 0-15
      }));
  } catch (error) {
      console.error('Error recommending names:', error);
      throw error;
  }
};

export const matchNames = async (name, type, names) => {
    try {
        const fuse = createFuseInstance(names);
        const results = fuse.search(name);
        
        return results
            .filter(result => {
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