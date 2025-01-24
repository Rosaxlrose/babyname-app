import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import Swal from 'sweetalert2';
import { recommendNames, matchNames, addNewName } from '../utils/nameAI';
import './AINameAnalysis.css';

const AINameAnalysis = () => {
    const [analysisType, setAnalysisType] = useState('recommend');
    const [formData, setFormData] = useState({
        name: '',
        desiredMeaning: '',
        characteristics: [],
        gender: '',
        matchType: 'twins'
    });
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [usedNames, setUsedNames] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const resultsPerPage = 5;

    useEffect(() => {
        const container = document.querySelector('.ai-name-analysis-container');
        if (container) {
            // Remove any existing bubbles first
            const existingBubbles = container.querySelectorAll('.ai-floating-bubble');
            existingBubbles.forEach(bubble => bubble.remove());
            
            // Add new bubbles
            for (let i = 0; i < 6; i++) {
                const bubble = document.createElement('div');
                bubble.className = 'ai-floating-bubble';
                bubble.style.width = `${Math.random() * 100 + 50}px`;
                bubble.style.height = bubble.style.width;
                bubble.style.left = `${Math.random() * 100}%`;
                bubble.style.top = `${Math.random() * 100}%`;
                bubble.style.animationDelay = `${Math.random() * 5}s`;
                container.appendChild(bubble);
            }
        }
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleNameClick = (name) => {
        Swal.fire({
            title: `👤 ${name.name}`,
            html: `
                <div class="text-left">
                    <p><strong>ความหมาย:</strong> ${name.meaning}</p>
                    <p><strong>แท็ก:</strong> ${name.tags.join(', ')}</p>
                    <p><strong>เพศ:</strong> ${name.gender === 'หญิง' ? '👧' : name.gender === 'ชาย' ? '👦' : '🌟'} ${name.gender}</p>
                    ${name.score ? `<p><strong>คะแนนความเหมาะสม:</strong> ⭐ ${name.score.toFixed(1)}</p>` : ''}
                </div>
            `,
            customClass: {
                popup: 'glass-container'
            }
        });
    };

    const handleAddNewName = async () => {
        const { value: formValues } = await Swal.fire({
            title: '✨ เพิ่มชื่อใหม่',
            html: `
                <input id="swal-name" class="swal2-input" placeholder="ชื่อ">
                <input id="swal-meaning" class="swal2-input" placeholder="ความหมาย">
                <input id="swal-tags" class="swal2-input" placeholder="แท็ก (คั่นด้วยเครื่องหมาย ,)">
                <select id="swal-gender" class="swal2-select">
                    <option value="ชาย">ชาย</option>
                    <option value="หญิง">หญิง</option>
                    <option value="ทั้งสอง">ใช้ได้ทั้งสองเพศ</option>
                </select>
            `,
            showCancelButton: true,
            confirmButtonText: '💾 บันทึก',
            cancelButtonText: '❌ ยกเลิก',
            customClass: {
                popup: 'glass-container'
            },
            preConfirm: () => {
                const name = document.getElementById('swal-name').value;
                const meaning = document.getElementById('swal-meaning').value;
                const tags = document.getElementById('swal-tags').value
                    .split(',')
                    .map(tag => tag.trim())
                    .filter(tag => tag);
                const gender = document.getElementById('swal-gender').value;

                if (!name || !meaning) {
                    Swal.showValidationMessage('⚠️ กรุณากรอกชื่อและความหมาย');
                    return false;
                }

                return { name, meaning, tags, gender };
            }
        });

        if (formValues) {
            try {
                await addNewName(formValues);
                Swal.fire({
                    title: '🎉 เพิ่มชื่อสำเร็จ',
                    text: 'ขอบคุณที่ช่วยเพิ่มข้อมูลให้กับระบบ',
                    icon: 'success',
                    customClass: {
                        popup: 'glass-container'
                    }
                });
            } catch (error) {
                Swal.fire({
                    title: '❌ เกิดข้อผิดพลาด',
                    text: error.message,
                    icon: 'error',
                    customClass: {
                        popup: 'glass-container'
                    }
                });
            }
        }
    };

    const handleSubmit = async (e, isRetry = false) => {
        e?.preventDefault();
        setIsLoading(true);

        try {
            const { data: names, error } = await supabase.from('names').select('*');
            if (error) throw error;

            let result;
            if (analysisType === 'recommend') {
                result = await recommendNames(formData.desiredMeaning, names);
            } else {
                result = await matchNames(formData.name, formData.matchType, names);
            }

            if (!result || result.length === 0) {
                throw new Error('ไม่พบผลลัพธ์');
            }

            // กรองชื่อที่ใช้ไปแล้ว
            const newNames = result.filter(name => !usedNames.has(name.id));
            
            if (newNames.length === 0) {
                await Swal.fire({
                    title: '⚠️ ไม่พบชื่อเพิ่มเติม',
                    text: 'ได้แสดงผลชื่อทั้งหมดที่ตรงกับเงื่อนไขแล้ว',
                    icon: 'warning',
                    confirmButtonText: 'เริ่มใหม่',
                    customClass: {
                        popup: 'glass-container'
                    }
                });
                setUsedNames(new Set());
                if (isRetry) {
                    handleSubmit(null, false);
                }
                return;
            }

            // เพิ่มชื่อที่ใช้แล้วเข้าไปใน Set
            newNames.forEach(name => usedNames.add(name.id));
            setUsedNames(new Set(usedNames));
            
            setResults(newNames);
            setCurrentPage(1);

            Swal.fire({
                title: '✨ พบชื่อที่เหมาะสม',
                text: `พบ ${newNames.length} ชื่อที่แนะนำ`,
                icon: 'success',
                customClass: {
                    popup: 'glass-container'
                }
            });

        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                title: '❌ เกิดข้อผิดพลาด',
                text: error.message || 'ไม่สามารถดำเนินการได้',
                icon: 'error',
                customClass: {
                    popup: 'glass-container'
                }
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="ai-name-analysis-container">
            <div className="glass-container max-w-full lg:max-w-4xl mx-auto w-[95%]">
                <h2 className="form-title">
                    <span className="star">🤖</span> AI แนะนำและจับคู่ชื่อ
                </h2>
                
                <div className="flex space-x-4 mb-6">
                    <button
                        onClick={() => {
                            setAnalysisType('recommend');
                            setUsedNames(new Set());
                            setResults([]);
                        }}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                            analysisType === 'recommend'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                        }`}
                    >
                        🎯 แนะนำชื่อ
                    </button>
                    <button
                        onClick={() => {
                            setAnalysisType('match');
                            setUsedNames(new Set());
                            setResults([]);
                        }}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                            analysisType === 'match'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground'
                        }`}
                    >
                        🤝 จับคู่ชื่อ
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {analysisType === 'recommend' ? (
                        <>
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    ความหมายที่ต้องการ
                                </label>
                                <input
                                    type="text"
                                    name="desiredMeaning"
                                    value={formData.desiredMeaning}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    placeholder="เช่น ความสุข, ความสำเร็จ, ความรัก"
                                    required
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    เพศ
                                </label>
                                <select
                                    name="gender"
                                    value={formData.gender}
                                    onChange={handleInputChange}
                                    className="form-input"
                                >
                                    <option value="">ทั้งหมด</option>
                                    <option value="ชาย">ชาย</option>
                                    <option value="หญิง">หญิง</option>
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    ชื่อที่ต้องการจับคู่
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    placeholder="ระบุชื่อที่ต้องการจับคู่"
                                    required
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    ประเภทการจับคู่
                                </label>
                                <select
                                    name="matchType"
                                    value={formData.matchType}
                                    onChange={handleInputChange}
                                    className="form-input"
                                >
                                    <option value="twins">👥 ฝาแฝด (ความหมายใกล้เคียงกัน)</option>
                                    <option value="siblings">👨‍👩‍👧‍👦 พี่น้อง (ความหมายเสริมกัน)</option>
                                </select>
                            </div>
                        </>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn btn-primary"
                        >
                            {isLoading ? '⏳ กำลังประมวลผล...' : '🔍 ค้นหา'}
                        </button>
                        <button
                            type="button"
                            onClick={handleAddNewName}
                            className="btn btn-secondary"
                        >
                            ✨ เพิ่มชื่อใหม่
                        </button>
                    </div>
                </form>

                {results.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-xl font-bold mb-4">
                            {analysisType === 'recommend' ? '🎯 ชื่อที่แนะนำ' : '🤝 ชื่อที่เข้าคู่'}
                        </h3>
                        <div className="results-grid">
                            {results.map((result) => (
                                <div
                                    key={result.id}
                                    onClick={() => handleNameClick(result)}
                                    className="name-card"
                                >
                                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                        <span className="star">
                                            {result.gender === 'หญิง' ? '👧' : result.gender === 'ชาย' ? '👦' : '🌟'}
                                        </span>
                                        {result.name}
                                    </h3>
                                    <p className="text-gray-600">{result.meaning}</p>
                                    <div className="mt-2">
                                        {result.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="tag"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                    {result.score > 0 && (
                                        <div className="mt-2 text-sm text-blue-600">
                                            คะแนนความเหมาะสม: {result.score.toFixed(1)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex justify-center">
                            <button
                                onClick={(e) => handleSubmit(e, true)}
                                className="btn btn-secondary"
                                disabled={isLoading}
                            >
                                {isLoading ? '⏳ กำลังค้นหา...' : '🔄 ค้นหาเพิ่มเติม'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AINameAnalysis;