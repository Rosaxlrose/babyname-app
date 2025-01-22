import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { nameAnalyzer } from '../utils/nameAnalyzer';
import Swal from 'sweetalert2';

const NameSubmissionForm = () => {
    const [formData, setFormData] = useState({
        fatherName: '',
        fatherMeaning: '',
        motherName: '',
        motherMeaning: '',
        desiredMeaning: '',
        babyGender: '',
        characteristics: []
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const checkNameInDatabase = async (name) => {
        const { data, error } = await supabase
            .from('names')
            .select('meaning')
            .eq('name', name)
            .single();

        if (error) {
            console.error('Error checking name:', error);
            return null;
        }

        return data;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // ตรวจสอบชื่อพ่อ
        const fatherNameData = await checkNameInDatabase(formData.fatherName);
        if (!fatherNameData) {
            const result = await Swal.fire({
                title: 'ชื่อของคุณพ่อไม่มีในระบบ',
                text: 'กรุณาช่วยเราพัฒนาระบบโดยใส่ความหมายของชื่อ',
                input: 'text',
                showCancelButton: true,
                confirmButtonText: 'ส่งความหมาย',
                cancelButtonText: 'ยกเลิก'
            });

            if (result.isConfirmed) {
                const analysis = await nameAnalyzer.analyzeMeaning(result.value);
                
                // บันทึกชื่อใหม่
                const { error } = await supabase
                    .from('user_submitted_names')
                    .insert([{
                        name: formData.fatherName,
                        meaning: result.value,
                        suggested_tags: analysis.suggestedTags
                    }]);

                if (error) {
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
                    return;
                }

                setFormData(prev => ({
                    ...prev,
                    fatherMeaning: result.value
                }));
            }
        }

        // ตรวจสอบชื่อแม่
        const motherNameData = await checkNameInDatabase(formData.motherName);
        if (!motherNameData) {
            const result = await Swal.fire({
                title: 'ชื่อของคุณแม่ไม่มีในระบบ',
                text: 'กรุณาช่วยเราพัฒนาระบบโดยใส่ความหมายของชื่อ',
                input: 'text',
                showCancelButton: true,
                confirmButtonText: 'ส่งความหมาย',
                cancelButtonText: 'ยกเลิก'
            });

            if (result.isConfirmed) {
                const analysis = await nameAnalyzer.analyzeMeaning(result.value);
                
                // บันทึกชื่อใหม่
                const { error } = await supabase
                    .from('user_submitted_names')
                    .insert([{
                        name: formData.motherName,
                        meaning: result.value,
                        suggested_tags: analysis.suggestedTags
                    }]);

                if (error) {
                    Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
                    return;
                }

                setFormData(prev => ({
                    ...prev,
                    motherMeaning: result.value
                }));
            }
        }

        // บันทึกข้อมูลความต้องการ
        const { error } = await supabase
            .from('name_preferences')
            .insert([{
                father_name: formData.fatherName,
                father_meaning: formData.fatherMeaning,
                mother_name: formData.motherName,
                mother_meaning: formData.motherMeaning,
                desired_meaning: formData.desiredMeaning,
                desired_characteristics: formData.characteristics,
                baby_gender: formData.babyGender
            }]);

        if (error) {
            Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
            return;
        }

        Swal.fire(
            'สำเร็จ!',
            'บันทึกข้อมูลเรียบร้อยแล้ว',
            'success'
        );
    };

    return (
        <div className="max-w-2xl mx-auto p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        ชื่อคุณพ่อ
                    </label>
                    <input
                        type="text"
                        name="fatherName"
                        value={formData.fatherName}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        ชื่อคุณแม่
                    </label>
                    <input
                        type="text"
                        name="motherName"
                        value={formData.motherName}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        ความหมายที่ต้องการ
                    </label>
                    <textarea
                        name="desiredMeaning"
                        value={formData.desiredMeaning}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        rows="3"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">
                        เพศของลูก
                    </label>
                    <select
                        name="babyGender"
                        value={formData.babyGender}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        required
                    >
                        <option value="">เลือกเพศ</option>
                        <option value="ชาย">ชาย</option>
                        <option value="หญิง">หญิง</option>
                    </select>
                </div>

                <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    ส่งข้อมูล
                </button>
            </form>
        </div>
    );
};

export default NameSubmissionForm;
