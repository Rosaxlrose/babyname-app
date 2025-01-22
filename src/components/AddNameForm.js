import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

const AddNameForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    meaning: '',
    tags: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase
        .from('names')
        .insert([{
          name: formData.name,
          meaning: formData.meaning,
          tags: formData.tags.split(',').map(tag => tag.trim()),
          added_by_user: true
        }]);

      if (error) throw error;
      alert('เพิ่มชื่อสำเร็จ!');
      setFormData({ name: '', meaning: '', tags: '' });
    } catch (error) {
      console.error('Error:', error.message);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">เพิ่มชื่อใหม่</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-2">ชื่อ</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-2">ความหมาย</label>
          <textarea
            value={formData.meaning}
            onChange={(e) => setFormData({...formData, meaning: e.target.value})}
            className="w-full p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-2">แท็ก (คั่นด้วยเครื่องหมายจุลภาค)</label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({...formData, tags: e.target.value})}
            className="w-full p-2 border rounded"
            placeholder="เช่น: พลัง, ธรรมชาติ, ความสุข"
            required
          />
        </div>
        <button
          type="submit"
          className="w-full bg-purple-500 text-white p-2 rounded hover:bg-purple-600"
        >
          เพิ่มชื่อ
        </button>
      </form>
    </div>
  );
};

export default AddNameForm;
