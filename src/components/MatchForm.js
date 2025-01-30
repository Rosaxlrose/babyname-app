import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faTrash, faRotate, faStar } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import './MatchForm.css';
import { suggestNamesWithAI } from '../utils/nameAI';
import { enhanceSearchTerms, addTrainingData } from '../utils/wordMeanings';
import { validateParentNames } from '../utils/parentNameManager';

const MatchForm = () => {
    const [formData, setFormData] = useState({
        fatherName: '',
        motherName: '',
        preferences: '',
        gender: ''
    });
    const [matchedNames, setMatchedNames] = useState([]);
    const [allMatchedNames, setAllMatchedNames] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showAddNameForm, setShowAddNameForm] = useState(false);
    const [nameToAdd, setNameToAdd] = useState({
        name: '',
        meaning: '',
        gender: '',
        tags: ''
    });
    const [showTryAgain, setShowTryAgain] = useState(false);
    const [screenSize, setScreenSize] = useState(window.innerWidth);
    const [usedNameIds, setUsedNameIds] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(0);
    
    const ITEMS_PER_PAGE = 6;

    // Memoized handlers
    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    }, []);

    const handleAddNameChange = useCallback((e) => {
        const { name, value } = e.target;
        setNameToAdd(prev => ({
            ...prev,
            [name]: value
        }));
    }, []);

    const handlePrevPage = useCallback(() => {
        if (currentPage > 0) {
            const newPage = currentPage - 1;
            const start = newPage * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            setCurrentPage(newPage);
            setMatchedNames(allMatchedNames.slice(start, end));
        }
    }, [currentPage, allMatchedNames]);

    const handleNextPage = useCallback(() => {
        const nextPage = currentPage + 1;
        const start = nextPage * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        if (start < allMatchedNames.length) {
            setCurrentPage(nextPage);
            setMatchedNames(allMatchedNames.slice(start, end));
        }
    }, [currentPage, allMatchedNames]);

    const showNextBatch = useCallback(async () => {
        setIsLoading(true);
        try {
            // ดึงชื่อที่ยังไม่เคยแสดงมาก่อน
            const currentIds = new Set(matchedNames.map(name => name.id));
            const unusedNames = allMatchedNames.filter(name => 
                !usedNameIds.has(name.id) && !currentIds.has(name.id)
            );

            if (unusedNames.length === 0) {
                await Swal.fire({
                    title: '📝 ไม่พบชื่อที่เหมาะสมเพิ่มเติม',
                    html: `
                        <div class="text-left">
                            <p class="mb-2">เกณฑ์การให้คะแนน (คะแนนเต็ม 15):</p>
                            <ul class="list-disc pl-5 space-y-1">
                                <li>คะแนนเริ่มต้น: 7 คะแนน</li>
                                <li>ตรงกับ tags ของพ่อแม่: +2 คะแนนต่อ tag</li>
                                <li>ตรงกับความชอบที่ระบุใน tags: +2 คะแนนต่อคำ</li>
                                <li>ตรงกับความชอบที่ระบุในความหมาย: +3 คะแนนต่อคำ</li>
                            </ul>
                            <p class="mt-2">ลองปรับเปลี่ยนความชอบหรือเงื่อนไขใหม่</p>
                        </div>
                    `,
                    icon: 'info',
                    confirmButtonText: 'ตกลง',
                    customClass: {
                        popup: 'glass-container',
                        confirmButton: 'btn btn-primary'
                    }
                });
                setShowTryAgain(false);
                return;
            }

            // เลือก 6 ชื่อที่มีคะแนนสูงสุดจากชื่อที่ยังไม่เคยแสดง
            const nextBatch = unusedNames.slice(0, ITEMS_PER_PAGE);
            
            // บันทึก ID ของชื่อที่แสดงแล้ว
            const newUsedIds = new Set([...usedNameIds, ...currentIds]);
            nextBatch.forEach(name => newUsedIds.add(name.id));
            setUsedNameIds(newUsedIds);

            // อัพเดทการแสดงผล
            setMatchedNames(nextBatch);
            
            // ตรวจสอบว่ายังมีชื่อที่ยังไม่ได้แสดงเหลืออยู่หรือไม่
            const remainingNames = unusedNames.length - ITEMS_PER_PAGE;
            setShowTryAgain(remainingNames > 0);

        } catch (error) {
            console.error('Error in showNextBatch:', error);
            Swal.fire({
                title: '❌ เกิดข้อผิดพลาด',
                text: 'ไม่สามารถดึงข้อมูลชื่อได้ กรุณาลองใหม่อีกครั้ง',
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
    }, [allMatchedNames, usedNameIds, matchedNames, ITEMS_PER_PAGE]);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setIsLoading(true);
        setMatchedNames([]);
        setAllMatchedNames([]);
        setCurrentPage(0);

        try {
            // ตรวจสอบและจัดการชื่อพ่อแม่
            const parentTags = await validateParentNames(formData.fatherName, formData.motherName);
            if (parentTags === null) {
                setIsLoading(false);
                return;
            }

            // Fetch names with optimized query
            let query = supabase.from('names').select('*');
            if (formData.gender) {
                query = query.eq('gender', formData.gender);
            }
            const { data: names, error } = await query;

            if (error) throw error;
            if (!names || names.length === 0) {
                throw new Error('ไม่พบข้อมูลชื่อในระบบ');
            }

            // Get AI suggestions
            const aiSuggestedNames = await suggestNamesWithAI(
                formData.preferences,
                Array.from(parentTags.keys()),
                names
            );

            // Filter names
            const filteredNames = aiSuggestedNames.filter(name => {
                // กรณีมีแค่ความชอบ ไม่ต้องตรวจสอบคะแนน
                if (formData.preferences && !formData.fatherName && !formData.motherName) {
                    return name.name !== formData.fatherName && name.name !== formData.motherName;
                }
                // กรณีอื่นๆ ตรวจสอบคะแนนด้วย
                return name.score >= 7 &&
                    name.name !== formData.fatherName && 
                    name.name !== formData.motherName;
            });

            // Set all matched names and show first batch
            setAllMatchedNames(filteredNames);
            setMatchedNames(filteredNames.slice(0, ITEMS_PER_PAGE));

            if (filteredNames.length > 0) {
                await Swal.fire({
                    title: `🎉 พบ ${filteredNames.length} ชื่อที่เหมาะสม`,
                    html: formData.preferences && !formData.fatherName && !formData.motherName
                        ? '<p>แสดงชื่อที่ตรงกับความชอบ/ความหมายที่ต้องการ</p>'
                        : `
                            <div class="text-left">
                                <p>แสดงชื่อที่มีความเหมาะสมมากที่สุดก่อน</p>
                                <p class="mt-2 font-semibold">เกณฑ์การให้คะแนน (คะแนนเต็ม 15):</p>
                                <ul class="list-disc pl-5 space-y-1">
                                    <li>คะแนนเริ่มต้น: 7 คะแนน</li>
                                    <li>ตรงกับ tags ของพ่อแม่: +2 คะแนนต่อ tag</li>
                                    <li>ตรงกับความชอบที่ระบุใน tags: +2 คะแนนต่อคำ</li>
                                    <li>ตรงกับความชอบที่ระบุในความหมาย: +3 คะแนนต่อคำ</li>
                                </ul>
                            </div>
                        `,
                    icon: 'success',
                    confirmButtonText: 'ตกลง',
                    customClass: {
                        popup: 'glass-container',
                        confirmButton: 'btn btn-primary'
                    }
                });
            } else {
                await Swal.fire({
                    title: '📝 ไม่พบชื่อที่เหมาะสม',
                    html: `
                        <div class="text-left">
                            <p>ลองปรับเปลี่ยนความชอบหรือเงื่อนไขใหม่</p>
                            <p class="mt-2 font-semibold">เกณฑ์การให้คะแนน (คะแนนเต็ม 15):</p>
                            <ul class="list-disc pl-5 space-y-1">
                                <li>คะแนนเริ่มต้น: 7 คะแนน</li>
                                <li>ตรงกับ tags ของพ่อแม่: +2 คะแนนต่อ tag</li>
                                <li>ตรงกับความชอบที่ระบุใน tags: +2 คะแนนต่อคำ</li>
                                <li>ตรงกับความชอบที่ระบุในความหมาย: +3 คะแนนต่อคำ</li>
                            </ul>
                        </div>
                    `,
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
            await Swal.fire({
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

            setShowAddNameForm(false);
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
        const handleResize = () => {
            setScreenSize(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
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
                <h2 className="form-title">
                    แมชชื่อที่เหมาะสม <span className="star">🔎</span>
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
                            {isLoading ? '⏳ กำลังประมวลผล...' : '🔍 ค้นหาชื่อใหม่'}
                        </button>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                            <button 
                                type="button" 
                                onClick={() => {
                                    clearForm();
                                    setAllMatchedNames([]);
                                    setCurrentPage(0);
                                    setMatchedNames([]);
                                }} 
                                className="btn btn-secondary"
                            >
                                <span className="star">🗑️</span>
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
                    <>
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
                                        {name.score !== null && (
                                            <div className="flex items-center gap-1">
                                                <span>ความเหมาะสม: {name.score}/15 คะแนน</span>
                                                <span className="star">⭐</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mt-6 w-full text-center">
    {/* ปุ่มก่อนหน้า */}
    <button 
        onClick={handlePrevPage}
        disabled={currentPage === 0}
        className={`btn btn-secondary px-5 py-3 text-base sm:text-lg ${
            currentPage === 0 ? 'opacity-50 cursor-not-allowed' : ''
        }`}
    >
        ⬅️ ก่อนหน้า
    </button>

    {/* ข้อความแสดงหน้าปัจจุบัน (อยู่ตรงกลางในคอม) */}
    <span className="text-base sm:text-lg font-medium sm:mx-4 mt-2 sm:mt-0 sm:order-none order-2">
        หน้า {currentPage + 1} จาก {Math.ceil(allMatchedNames.length / ITEMS_PER_PAGE)}
    </span>

    {/* ปุ่มถัดไป */}
    <button 
        onClick={handleNextPage}
        disabled={(currentPage + 1) * ITEMS_PER_PAGE >= allMatchedNames.length}
        className={`btn btn-secondary px-5 py-3 text-base sm:text-lg ${
            (currentPage + 1) * ITEMS_PER_PAGE >= allMatchedNames.length ? 'opacity-50 cursor-not-allowed' : ''
        }`}
    >
        ถัดไป ➡️
    </button>
</div>

                    </>
                )}
            </div>
        </div>
    );
};

export default MatchForm;