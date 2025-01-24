import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { supabase } from '../supabaseClient';

const MySwal = withReactContent(Swal);

const NameManager = () => {
  const [names, setNames] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // โหลดรายชื่อทั้งหมด
  const fetchNames = async () => {
    const { data, error } = await supabase.from('names').select('*');
    if (error) {
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้', 'error');
    } else {
      const sortedData = data.sort((a, b) => {
        const removeVowels = (str) => str.replace(/[เแโใไ]/g, '');
        return removeVowels(a.name).localeCompare(removeVowels(b.name), 'th');
      });
      setNames(sortedData);
    }
  };

  useEffect(() => {
    fetchNames();
  }, []);

  // ฟังก์ชันเปิดฟอร์มใน SweetAlert2
  const openForm = async (mode, existingData = null) => {
    const isEditMode = mode === 'edit';

    const { value: formData } = await MySwal.fire({
      title: isEditMode ? 'แก้ไขชื่อ' : 'เพิ่มชื่อใหม่',
      html: `
        <div class="space-y-4">
          <div>
            <label class="block text-left font-medium">ชื่อ</label>
            <input id="name" class="swal2-input" value="${existingData?.name || ''}" required>
          </div>
          <div>
            <label class="block text-left font-medium">ความหมาย</label>
            <textarea id="meaning" class="swal2-textarea" required>${existingData?.meaning || ''}</textarea>
          </div>
          <div>
            <label class="block text-left font-medium">แท็ก (คั่นด้วยเครื่องหมายจุลภาค)</label>
            <input id="tags" class="swal2-input" value="${existingData?.tags?.join(', ') || ''}">
          </div>
          <div>
            <label class="block text-left font-medium">เพศ</label>
            <select id="gender" class="swal2-select">
              <option value="ชาย" ${existingData?.gender === 'ชาย' ? 'selected' : ''}>ชาย</option>
              <option value="หญิง" ${existingData?.gender === 'หญิง' ? 'selected' : ''}>หญิง</option>
              <option value="ใช้ได้กับทั้งสอง" ${existingData?.gender === 'ใช้ได้กับทั้งสอง' ? 'selected' : ''}>ใช้ได้กับทั้งสอง</option>
            </select>
          </div>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: isEditMode ? 'บันทึก' : 'เพิ่ม',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => {
        const name = document.getElementById('name').value.trim();
        const meaning = document.getElementById('meaning').value.trim();
        const tags = document.getElementById('tags').value.split(',').map((tag) => tag.trim());
        const gender = document.getElementById('gender').value;

        if (!name || !meaning || !gender) {
          Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
        }

        return { name, meaning, tags, gender };
      },
    });

    if (formData) {
      try {
        if (isEditMode) {
          // ตรวจสอบว่าชื่อที่แก้ไขซ้ำกับชื่ออื่นในฐานข้อมูลหรือไม่
          const duplicateCheck = names.some(
            (n) => n.name === formData.name && n.id !== existingData.id
          );
          if (duplicateCheck) {
            Swal.fire('เกิดข้อผิดพลาด', 'ชื่อนี้มีอยู่ในระบบแล้ว', 'error');
            return;
          }

          // อัปเดตข้อมูล
          const { error } = await supabase.from('names').update(formData).eq('id', existingData.id);
          if (error) throw error;
          Swal.fire('สำเร็จ!', 'แก้ไขข้อมูลเรียบร้อยแล้ว', 'success');
        } else {
          // ตรวจสอบว่าชื่อใหม่ซ้ำหรือไม่
          const duplicateCheck = names.some((n) => n.name === formData.name);
          if (duplicateCheck) {
            Swal.fire('เกิดข้อผิดพลาด', 'ชื่อนี้มีอยู่ในระบบแล้ว', 'error');
            return;
          }

          // เพิ่มข้อมูลใหม่
          const { error } = await supabase.from('names').insert([{ ...formData, added_by_user: true }]);
          if (error) throw error;
          Swal.fire('สำเร็จ!', 'เพิ่มชื่อใหม่เรียบร้อยแล้ว', 'success');
        }
        fetchNames();
      } catch (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
      }
    }
  };

  // ฟังก์ชันลบข้อมูล
  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'คุณแน่ใจหรือไม่?',
      text: 'การลบนี้ไม่สามารถย้อนกลับได้!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก',
    });

    if (result.isConfirmed) {
      try {
        const { error } = await supabase.from('names').delete().eq('id', id);
        if (error) throw error;
        Swal.fire('สำเร็จ!', 'ลบข้อมูลเรียบร้อยแล้ว', 'success');
        fetchNames();
      } catch (error) {
        Swal.fire('เกิดข้อผิดพลาด', error.message, 'error');
      }
    }
  };

  // กรองข้อมูลตามคำค้นหา
  const filteredNames = names.filter((name) => {
    const term = searchTerm.toLowerCase();
    return (
      name.name.toLowerCase().includes(term) ||
      name.meaning.toLowerCase().includes(term) ||
      name.tags.some((tag) => tag.toLowerCase().includes(term))
    );
  });

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">จัดการชื่อ</h2>
        <button
          onClick={() => openForm('add')}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          เพิ่มชื่อใหม่
        </button>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder="ค้นหาโดยชื่อ ความหมาย หรือแท็ก..."
        />
      </div>

      {/* Table Section */}
      <table className="w-full border-collapse border border-gray-300 rounded-md overflow-hidden">
        <thead>
          <tr className="bg-purple-500 text-white">
            <th className="border border-purple-300 p-2">ชื่อ</th>
            <th className="border border-purple-300 p-2">ความหมาย</th>
            <th className="border border-purple-300 p-2">แท็ก</th>
            <th className="border border-purple-300 p-2">เพศ</th>
            <th className="border border-purple-300 p-2">การจัดการ</th>
          </tr>
        </thead>
        <tbody>
          {filteredNames.map((name) => (
            <tr key={name.id} className="hover:bg-gray-100">
              <td className="border border-gray-300 p-2">{name.name}</td>
              <td className="border border-gray-300 p-2">{name.meaning}</td>
              <td className="border border-gray-300 p-2">{name.tags.join(', ')}</td>
              <td className="border border-gray-300 p-2">{name.gender}</td>
              <td className="border border-gray-300 p-2 space-x-2">
                <button
                  onClick={() => openForm('edit', name)}
                  className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => handleDelete(name.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                >
                  ลบ
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default NameManager;
