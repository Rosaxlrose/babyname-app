import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faTrash, faRotate, faStar, faHeart } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import './MatchForm.css';
const MatchForm = () => {
    const [formData, setFormData] = useState({
        fatherName: '',
        motherName: '',
        preferences: '',
        gender: ''
    });
    const [matchedNames, setMatchedNames] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAddNameForm, setShowAddNameForm] = useState(false);
    const [previouslyShownNames, setPreviouslyShownNames] = useState(new Set());
    const [nameToAdd, setNameToAdd] = useState({
        name: '',
        meaning: '',
        gender: '',
        tags: ''
    });
    const [showTryAgain, setShowTryAgain] = useState(false);
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const handleAddNameChange = (e) => {
        const { name, value } = e.target;
        setNameToAdd(prev => ({
            ...prev,
            [name]: value
        }));
    };
    const handleAddName = async (e) => {
        e.preventDefault();
        try {
            const tagsArray = nameToAdd.tags.split(',').map(tag => tag.trim());
            const { data, error } = await supabase
                .from('names')
                .insert([{
                    name: nameToAdd.name,
                    meaning: nameToAdd.meaning,
                    gender: nameToAdd.gender,
                    tags: tagsArray
                }]);
            if (error) throw error;
            Swal.fire({
                icon: 'success',
                title: 'เพิ่มชื่อสำเร็จ',
                text: 'ชื่อถูกเพิ่มเข้าฐานข้อมูลแล้ว',
                confirmButtonText: 'ค้นหาชื่ออีกครั้ง'
            }).then((result) => {
                if (result.isConfirmed) {
                    setShowAddNameForm(false);
                    handleSubmit(e, true);
                }
            });
        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'เกิดข้อผิดพลาด',
                text: 'ไม่สามารถเพิ่มชื่อได้ กรุณาลองใหม่อีกครั้ง',
                confirmButtonText: 'ตกลง'
            });
        }
    };
    const handleSubmit = async (e, isRetry = false) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        let parentTags = new Set(); 
        let missingParentName = null;
        let missingNameValue = '';
        
        try {
            if (formData.fatherName) {
                const { data: fatherData, error: fatherError } = await supabase
                    .from('names')
                    .select('tags')
                    .eq('name', formData.fatherName)
                    .single();
                if (fatherError) {
                    missingParentName = 'ชื่อพ่อ';
                    missingNameValue = formData.fatherName;
                } else if (fatherData) {
                    fatherData.tags.forEach(tag => parentTags.add(tag));
                }
            }
            if (formData.motherName) {
                const { data: motherData, error: motherError } = await supabase
                    .from('names')
                    .select('tags')
                    .eq('name', formData.motherName)
                    .single();
                if (motherError) {
                    missingParentName = missingParentName ? `${missingParentName}และชื่อแม่` : 'ชื่อแม่';
                    missingNameValue = formData.motherName;
                } else if (motherData) {
                    motherData.tags.forEach(tag => parentTags.add(tag));
                }
            }
            if (missingParentName) {
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

                if (result.isConfirmed) {
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

                    if (formValues) {
                        try {
                            const { data, error } = await supabase
                                .from('names')
                                .insert([formValues]);

                            if (error) throw error;

                            await Swal.fire({
                                title: '✅ เพิ่มชื่อสำเร็จ',
                                text: 'ชื่อถูกเพิ่มเข้าฐานข้อมูลแล้ว',
                                icon: 'success',
                                confirmButtonText: 'ค้นหาชื่ออีกครั้ง',
                                customClass: {
                                    popup: 'glass-container',
                                    confirmButton: 'btn btn-primary'
                                }
                            });

                            handleSubmit(null, true);
                        } catch (error) {
                            console.error('Error:', error);
                            Swal.fire({
                                title: '❌ เกิดข้อผิดพลาด',
                                text: 'ไม่สามารถเพิ่มชื่อได้ กรุณาลองใหม่อีกครั้ง',
                                icon: 'error',
                                confirmButtonText: 'ตกลง',
                                customClass: {
                                    popup: 'glass-container',
                                    confirmButton: 'btn btn-primary'
                                }
                            });
                        }
                    }
                }
                return;
            }
    

            let query = supabase
                .from('names')
                .select('*');
            if (formData.gender) {
                query = query.eq('gender', formData.gender);
            }
            const { data: names, error } = await query;
            if (error) throw error;
            if (!names || names.length === 0) {
                throw new Error('ไม่พบข้อมูลชื่อในระบบ');
            }

        // เรียกใช้ analyzePreferences เพื่อได้ชื่อทั้งหมดที่ match
        const allMatchedNames = analyzePreferences(formData.preferences, names, parentTags);
            
        // กรองชื่อที่เคยแสดงแล้วออก
        const newMatchedNames = allMatchedNames.filter(name => 
            !previouslyShownNames.has(name.name) &&
            name.name !== formData.fatherName && 
            name.name !== formData.motherName
        ).slice(0, 5);

        // เพิ่มชื่อใหม่ที่จะแสดงเข้าไปใน Set ของชื่อที่เคยแสดงแล้ว
        newMatchedNames.forEach(name => {
            previouslyShownNames.add(name.name);
        });
        setPreviouslyShownNames(new Set(previouslyShownNames));

        setMatchedNames(newMatchedNames);
        setShowTryAgain(allMatchedNames.length > newMatchedNames.length);

        if (newMatchedNames.length > 0) {
            Swal.fire({
                title: `🎉 พบ ${newMatchedNames.length} ชื่อที่แนะนำ${isRetry ? 'ใหม่' : ''}`,
                text: newMatchedNames.map(name => name.name).join(', '),
                icon: 'success',
                confirmButtonText: 'ตกลง',
                customClass: {
                    popup: 'glass-container',
                    confirmButton: 'btn btn-primary'
                }
            });
        } else {
            Swal.fire({
                title: '📝 ไม่พบชื่อที่แนะนำเพิ่มเติม',
                text: 'ลองปรับเปลี่ยนความชอบหรือเงื่อนไขใหม่',
                icon: 'info',
                confirmButtonText: 'ตกลง',
                customClass: {
                    popup: 'glass-container',
                    confirmButton: 'btn btn-primary'
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            title: '❌ เกิดข้อผิดพลาด',
            text: error.message || 'ไม่สามารถค้นหาชื่อได้ กรุณาลองใหม่อีกครั้ง',
            icon: 'error',
            confirmButtonText: 'ตกลง',
            customClass: {
                popup: 'glass-container',
                confirmButton: 'btn btn-primary'
            }
        });
    } finally {
        setIsLoading(false);
    }
};
    const analyzePreferences = (preferences, names, parentTags) => {
        const prefs = preferences.toLowerCase().split(',').map(p => p.trim());
        const scoredNames = names.map(name => {
            let score = 0;
            if (parentTags.size > 0) {
                name.tags.forEach(tag => {
                    if (parentTags.has(tag)) {
                        score += 2;
                    }
                });
            }
            prefs.forEach(pref => {
                if (name.meaning.toLowerCase().includes(pref)) {
                    score += 3;
                }
                name.tags.forEach(tag => {
                    if (tag.toLowerCase().includes(pref)) {
                        score += 2;
                    }
                });
            });
            return { ...name, score };
        });
        const topNames = scoredNames
            .filter(n => n.score > 0)
            .sort((a, b) => b.score - a.score);
        return topNames;
    };
    const handleNameClick = (name) => {
        Swal.fire({
            title: `👤 ${name.name}`,
            html: `
                <div class="text-left">
                    <p><strong>ความหมาย:</strong> ${name.meaning}</p>
                    <p><strong>แท็ก:</strong> ${name.tags.join(', ')}</p>
                    <p><strong>เพศ:</strong> ${name.gender === 'หญิง' ? '👧' : name.gender === 'ชาย' ? '👦' : '🌟'} ${name.gender}</p>
                    ${name.score ? `<p><strong>คะแนนความเหมาะสม:</strong> ⭐ ${name.score}</p>` : ''}
                </div>
            `,
            confirmButtonText: 'ปิด',
            customClass: {
                popup: 'glass-container',
                confirmButton: 'btn btn-primary'
            }
        });
    };
    const clearForm = () => {
        setFormData({
            fatherName: '',
            motherName: '',
            preferences: '',
            gender: ''
        });
        setMatchedNames([]);
        setShowTryAgain(false);
    };

    useEffect(() => {
      // Create floating bubbles
      const container = document.querySelector('.match-form-container');
      if (container) {
          for (let i = 0; i < 6; i++) {
              const bubble = document.createElement('div');
              bubble.className = 'floating-bubble';
              bubble.style.width = `${Math.random() * 100 + 50}px`;
              bubble.style.height = bubble.style.width;
              bubble.style.left = `${Math.random() * 100}%`;
              bubble.style.top = `${Math.random() * 100}%`;
              bubble.style.animationDelay = `${Math.random() * 5}s`;
              container.appendChild(bubble);
          }
      }
  }, []);
    
  return (
    <div className="match-form-container">
           <div className="glass-container max-w-full lg:max-w-4xl mx-auto w-[95%]">
        <div className="glass-container">
            <h2 className="form-title">
            <span className="star">🔎</span>แมชชื่อที่เหมาะสม 
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                        ชื่อพ่อ (ไม่จำเป็น)
                    </label>
                    <input 
                        type="text" 
                        name="fatherName" 
                        value={formData.fatherName} 
                        onChange={handleChange} 
                        className="form-input"
                        placeholder="ระบุชื่อพ่อ" 
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                        ชื่อแม่ (ไม่จำเป็น)
                    </label>
                    <input 
                        type="text" 
                        name="motherName" 
                        value={formData.motherName} 
                        onChange={handleChange} 
                        className="form-input"
                        placeholder="ระบุชื่อแม่" 
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                        ความชอบ/ความหมายที่ต้องการ
                    </label>
                    <textarea 
                        name="preferences" 
                        value={formData.preferences} 
                        onChange={handleChange} 
                        className="form-input"
                        placeholder="เช่น ความสุข, ความสำเร็จ, ความรัก" 
                        rows={3}
                    />
                </div>

                <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                        เพศ
                    </label>
                    <select 
                        name="gender" 
                        value={formData.gender} 
                        onChange={handleChange} 
                        className="form-input"
                    >
                        <option value="">ทั้งหมด</option>
                        <option value="ชาย">ชาย</option>
                        <option value="หญิง">หญิง</option>
                    </select>
                </div>

                <div className="button-group">
                        <button 
                            type="submit" 
                            disabled={isLoading} 
                            className="btn btn-primary"
                        >
                            <FontAwesomeIcon icon={faMagnifyingGlass} />
                            {isLoading ? 'กำลังค้นหา...' : 'ค้นหา'}
                        </button>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                            {showTryAgain && (
                                <button 
                                    onClick={handleSubmit} 
                                    className="btn btn-secondary"
                                >
                                    <FontAwesomeIcon icon={faRotate} />
                                    ลองอีกครั้ง
                                </button>
                            )}
                            <button 
                                type="button" 
                                onClick={clearForm} 
                                className="btn btn-secondary"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                                ล้างฟอร์ม
                            </button>
                    </div>
                </div>
            </form>
                {showAddNameForm && (
                    <form onSubmit={handleAddName} className="add-name-form">
                        <div className="input-group">
                            <label className="input-label">ชื่อ</label>
                            <input 
                                type="text" 
                                name="name" 
                                value={nameToAdd.name} 
                                onChange={handleAddNameChange} 
                                className="form-input"
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">ความหมาย</label>
                            <textarea 
                                name="meaning" 
                                value={nameToAdd.meaning} 
                                onChange={handleAddNameChange} 
                                className="form-input"
                                rows={3}
                                required 
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">เพศ</label>
                            <select 
                                name="gender" 
                                value={nameToAdd.gender} 
                                onChange={handleAddNameChange} 
                                className="form-input"
                                required
                            >
                                <option value="ชาย">ชาย</option>
                                <option value="หญิง">หญิง</option>
                                <option value="ใช้ได้กับทั้งสอง">ใช้ได้กับทั้งสอง</option>
                            </select>
                        </div>
                        <div className="input-group">
                            <label className="input-label">แท็ก (คั่นด้วยเครื่องหมาย ,)</label>
                            <input 
                                type="text" 
                                name="tags" 
                                value={nameToAdd.tags} 
                                onChange={handleAddNameChange} 
                                className="form-input"
                                placeholder="เช่น มงคล, ความสุข, ความสำเร็จ" 
                                required 
                            />
                        </div>
                        <div className="button-group">
                            <button 
                                type="button" 
                                onClick={() => setShowAddNameForm(false)} 
                                className="btn btn-secondary"
                            >
                                ยกเลิก
                            </button>
                            <button 
                                type="submit" 
                                className="btn btn-primary"
                            >
                                บันทึก
                            </button>
                        </div>
                    </form>
                )}
                  {matchedNames.length > 0 && (
                    <div className="results-grid">
                        {matchedNames.map((name) => (
                            <div
                                key={name.id}
                                onClick={() => handleNameClick(name)}
                                className="name-card"
                            >
                               <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
  <span className="star">
    {name.gender === 'หญิง' ? '👧' : name.gender === 'ชาย' ? '👦' : '🌟'}
  </span>
  {name.name}
</h3>

                                <p className="text-gray-600">{name.meaning}</p>
                                <div className="mt-2">
                                    {name.tags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="tag"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-2 text-sm text-blue-600">
                                    คะแนนความเหมาะสม: {name.score}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
    );
};

export default MatchForm;