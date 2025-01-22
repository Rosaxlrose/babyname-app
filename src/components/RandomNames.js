import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

const RandomNames = () => {
  const [randomNames, setRandomNames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const getRandomNames = async () => {
    try {
      setIsLoading(true);
      console.log('เริ่มดึงข้อมูล...');

      // ดึงข้อมูลชื่อทั้งหมด
      const { data, error } = await supabase
        .from('names')
        .select('*');

      console.log('ผลลัพธ์:', { data, error });

      if (error) {
        console.error('Error fetching random names:', error);
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: 'ไม่สามารถดึงข้อมูลชื่อได้ กรุณาลองใหม่อีกครั้ง',
          confirmButtonText: 'ตกลง'
        });
        return;
      }

      if (!data || data.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'ไม่พบข้อมูล',
          text: 'ไม่พบข้อมูลชื่อในระบบ',
          confirmButtonText: 'ตกลง'
        });
        return;
      }

      // สุ่มลำดับของชื่อ
      const shuffledNames = data.sort(() => Math.random() - 0.5);
      setRandomNames(shuffledNames.slice(0, 15)); // แสดง 15 ชื่อ

      Swal.fire({
        icon: 'success',
        title: 'สุ่มชื่อสำเร็จ',
        text: `แสดง 15 ชื่อจากทั้งหมด ${data.length} ชื่อ`,
        showConfirmButton: false,
        timer: 1500
      });

    } catch (error) {
      console.error('Error:', error);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'กรุณาลองใหม่อีกครั้ง',
        confirmButtonText: 'ตกลง'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNameClick = (name) => {
    Swal.fire({
      icon: 'info',
      title: name.name,
      html: `
        <div class="text-left">
          <p><strong>ความหมาย:</strong> ${name.meaning}</p>
          <p><strong>แท็ก:</strong> ${name.tags.join(', ')}</p>
          <p><strong>เพศ:</strong> ${name.gender}</p>
        </div>
      `,
      confirmButtonText: 'ปิด'
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">สุ่มชื่อ</h2>
        <button
          onClick={getRandomNames}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400"
        >
          {isLoading ? 'กำลังโหลด...' : 'สุ่มใหม่'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {randomNames.map((name) => (
          <div
            key={name.id}
            onClick={() => handleNameClick(name)}
            className="p-4 border rounded-lg shadow hover:shadow-lg cursor-pointer transition-shadow"
          >
            <h3 className="text-xl font-bold mb-2">{name.name}</h3>
            <p className="text-gray-600">{name.meaning}</p>
            <div className="mt-2">
              {name.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RandomNames;
