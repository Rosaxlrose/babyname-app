import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';

export const handleMissingParentName = async (missingParentName, missingNameValue) => {
    const result = await Swal.fire({
        title: `⚠️ ไม่พบ${missingParentName}ในระบบ`,
        text: 'กรุณาเพิ่มข้อมูลเพื่อช่วยเราพัฒนาระบบ',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'เพิ่มข้อมูล',
        cancelButtonText: 'ยกเลิก',
        customClass: {
            popup: 'glass-container',
            confirmButton: 'btn btn-primary',
            cancelButton: 'btn btn-secondary'
        }
    });

    if (!result.isConfirmed) {
        return null;
    }

    const { value: formValues } = await Swal.fire({
        title: '📝 เพิ่มข้อมูลชื่อ',
        html: `
            <form id="addNameForm" class="space-y-4">
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">ชื่อ</label>
                    <input type="text" id="name" class="form-input w-full" value="${missingNameValue}" required>
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">ความหมาย</label>
                    <textarea id="meaning" class="form-input w-full" rows="3" required></textarea>
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">เพศ</label>
                    <select id="gender" class="form-input w-full" required>
                        <option value="ชาย">ชาย</option>
                        <option value="หญิง">หญิง</option>
                        <option value="ใช้ได้กับทั้งสอง">ใช้ได้กับทั้งสอง</option>
                    </select>
                </div>
                <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700">แท็ก (คั่นด้วยเครื่องหมาย ,)</label>
                    <input type="text" id="tags" class="form-input w-full" placeholder="เช่น มงคล, ความสุข, ความสำเร็จ" required>
                </div>
            </form>
        `,
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        customClass: {
            popup: 'glass-container',
            confirmButton: 'btn btn-primary',
            cancelButton: 'btn btn-secondary'
        },
        preConfirm: () => {
            const form = document.getElementById('addNameForm');
            const name = document.getElementById('name').value;
            const meaning = document.getElementById('meaning').value;
            const gender = document.getElementById('gender').value;
            const tags = document.getElementById('tags').value;
            
            if (!name || !meaning || !gender || !tags) {
                Swal.showValidationMessage('⚠️ กรุณากรอกข้อมูลให้ครบถ้วน');
                return false;
            }
            
            return {
                name,
                meaning,
                gender,
                tags: tags.split(',').map(tag => tag.trim())
            };
        }
    });

    if (!formValues) {
        return null;
    }

    try {
        const { data, error } = await supabase
            .from('names')
            .insert([formValues]);

        if (error) throw error;

        await Swal.fire({
            title: '✅ เพิ่มชื่อสำเร็จ',
            text: 'ชื่อถูกเพิ่มเข้าฐานข้อมูลแล้ว',
            icon: 'success',
            confirmButtonText: 'ตกลง',
            customClass: {
                popup: 'glass-container',
                confirmButton: 'btn btn-primary'
            }
        });

        return formValues;
    } catch (error) {
        console.error('Error:', error);
        await Swal.fire({
            title: '❌ เกิดข้อผิดพลาด',
            text: 'ไม่สามารถเพิ่มชื่อได้ กรุณาลองใหม่อีกครั้ง',
            icon: 'error',
            confirmButtonText: 'ตกลง',
            customClass: {
                popup: 'glass-container',
                confirmButton: 'btn btn-primary'
            }
        });
        return null;
    }
};

export const validateParentNames = async (fatherName, motherName) => {
    let missingParentName = null;
    let missingNameValue = '';

    // Fetch parent data in parallel
    const [fatherData, motherData] = await Promise.all([
        fatherName ? supabase
            .from('names')
            .select('tags')
            .eq('name', fatherName)
            .single() : null,
        motherName ? supabase
            .from('names')
            .select('tags')
            .eq('name', motherName)
            .single() : null
    ]);

    if (fatherName && !fatherData?.data) {
        missingParentName = 'ชื่อพ่อ';
        missingNameValue = fatherName;
    }

    if (motherName && !motherData?.data) {
        missingParentName = missingParentName ? `${missingParentName}และชื่อแม่` : 'ชื่อแม่';
        missingNameValue = motherName;
    }

    if (missingParentName) {
        const result = await handleMissingParentName(missingParentName, missingNameValue);
        if (result) {
            // ถ้าเพิ่มชื่อสำเร็จ ให้ดึงข้อมูลใหม่
            return validateParentNames(fatherName, motherName);
        }
        return null;
    }

    // Return parent tags
    const parentTags = new Map();
    if (fatherData?.data) {
        fatherData.data.tags.forEach(tag => parentTags.set(tag, true));
    }
    if (motherData?.data) {
        motherData.data.tags.forEach(tag => parentTags.set(tag, true));
    }

    return parentTags;
};
