import { pipeline } from '@huggingface/transformers';
import Fuse from 'fuse.js';
import { supabase } from '../supabaseClient';

// สร้าง Fuse instance สำหรับการค้นหาแบบ fuzzy
const createFuseInstance = (names) => {
  return new Fuse(names, {
    keys: ['name', 'meaning', 'tags'],
    threshold: 0.4,
    includeScore: true
  });
};

// ฟังก์ชันสำหรับการแนะนำชื่อ
export const recommendNames = async (preferences, names) => {
  try {
    const fuse = createFuseInstance(names);
    const results = fuse.search(preferences);
    return results.map(result => ({
      ...result.item,
      score: Math.round((1 - result.score) * 10) // ปัดเศษให้เป็นจำนวนเต็ม
    }));
  } catch (error) {
    console.error('Error recommending names:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับการจับคู่ชื่อ
export const matchNames = async (name, type, names) => {
  try {
    const fuse = createFuseInstance(names);
    const results = fuse.search(name);
    
    return results
      .filter(result => {
        // กรองชื่อที่ตรงกับชื่อที่ผู้ใช้กรอกออก
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
        score: Math.round((1 - result.score) * 10) // ปัดเศษให้เป็นจำนวนเต็ม
      }));
  } catch (error) {
    console.error('Error matching names:', error);
    throw error;
  }
};

// ฟังก์ชันสำหรับเพิ่มชื่อใหม่
export const addNewName = async (nameData) => {
  try {
    // ตรวจสอบชื่อซ้ำ
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