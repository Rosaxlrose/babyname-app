import React, { useState } from 'react';
import { nameAnalyzer } from '../utils/nameAnalyzer';
import Swal from 'sweetalert2';

const AINameAnalysis = () => {
    const [analysisType, setAnalysisType] = useState('recommend'); // recommend, analyze, match
    const [formData, setFormData] = useState({
        name: '',
        desiredMeaning: '',
        characteristics: [],
        gender: '',
        matchType: 'twins', // twins, siblings
    });
    const [results, setResults] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleCharacteristicsChange = (e) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            characteristics: value.split(',').map(char => char.trim())
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setResults(null);

        try {
            let result;
            switch (analysisType) {
                case 'recommend':
                    if (!formData.desiredMeaning) {
                        throw new Error('กรุณาระบุความหมายที่ต้องการ');
                    }
                    result = await nameAnalyzer.recommendNames(formData);
                    break;
                case 'analyze':
                    if (!formData.name) {
                        throw new Error('กรุณาระบุชื่อที่ต้องการวิเคราะห์');
                    }
                    result = await nameAnalyzer.analyzeNameMeaning(formData.name);
                    break;
                case 'match':
                    if (!formData.name) {
                        throw new Error('กรุณาระบุชื่อที่ต้องการจับคู่');
                    }
                    result = await nameAnalyzer.findMatchingNames(formData.name, formData.matchType);
                    break;
                default:
                    throw new Error('Invalid analysis type');
            }

            if (!result) {
                throw new Error('ไม่พบผลลัพธ์');
            }

            setResults(result);
            
            // แสดงผลลัพธ์ด้วย Swal
            if (analysisType === 'analyze') {
                Swal.fire({
                    title: `การวิเคราะห์ชื่อ "${formData.name}"`,
                    html: `
                        <div class="text-left">
                            <p><strong>ความหมายหลัก:</strong> ${result.primaryMeaning}</p>
                            <p><strong>หมวดหมู่:</strong> ${result.categories.join(', ') || '-'}</p>
                            <p><strong>ลักษณะเด่น:</strong> ${result.characteristics.join(', ') || '-'}</p>
                            <p><strong>บริบททางวัฒนธรรม:</strong> ${result.culturalContext.join(', ') || '-'}</p>
                            ${result.recommendations.length > 0 ? `<p><strong>คำแนะนำ:</strong> ${result.recommendations.join(', ')}</p>` : ''}
                        </div>
                    `,
                    icon: 'info'
                });
            }

        } catch (error) {
            console.error('Error:', error);
            Swal.fire({
                title: 'เกิดข้อผิดพลาด',
                text: error.message || 'ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง',
                icon: 'error'
            });
            setResults(null);
        } finally {
            setIsLoading(false);
        }
    };

    const renderForm = () => {
        switch (analysisType) {
            case 'recommend':
                return (
                    <div className="match-form-container">
                        <form onSubmit={handleSubmit} className="glass-container">
                            <h2>การวิเคราะห์ชื่อ</h2>
                            <div>
                                <label>ความหมายที่ต้องการ:</label>
                                <input type="text" name="desiredMeaning" value={formData.desiredMeaning} onChange={handleInputChange} required />
                            </div>
                            <div>
                                <label>ลักษณะ:</label>
                                <input type="text" name="characteristics" value={formData.characteristics.join(', ')} onChange={handleCharacteristicsChange} />
                            </div>
                            <div>
                                <label>เพศ:</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                                    <option value="">เลือกเพศ</option>
                                    <option value="ชาย">ชาย</option>
                                    <option value="หญิง">หญิง</option>
                                </select>
                            </div>
                            <button type="submit" disabled={isLoading}>{isLoading ? 'กำลังโหลด...' : 'วิเคราะห์ชื่อ'}</button>
                        </form>
                    </div>
                );

            case 'analyze':
                return (
                    <div className="match-form-container">
                        <form onSubmit={handleSubmit} className="glass-container">
                            <h2>การวิเคราะห์ชื่อ</h2>
                            <div>
                                <label>ชื่อ:</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                            </div>
                            <div>
                                <label>เพศ:</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                                    <option value="">เลือกเพศ</option>
                                    <option value="ชาย">ชาย</option>
                                    <option value="หญิง">หญิง</option>
                                </select>
                            </div>
                            <button type="submit" disabled={isLoading}>{isLoading ? 'กำลังโหลด...' : 'วิเคราะห์ชื่อ'}</button>
                        </form>
                    </div>
                );

            case 'match':
                return (
                    <div className="match-form-container">
                        <form onSubmit={handleSubmit} className="glass-container">
                            <h2>การวิเคราะห์ชื่อ</h2>
                            <div>
                                <label>ชื่อ:</label>
                                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                            </div>
                            <div>
                                <label>ประเภทการจับคู่:</label>
                                <select name="matchType" value={formData.matchType} onChange={handleInputChange}>
                                    <option value="twins">ฝาแฝด</option>
                                    <option value="siblings">พี่น้อง</option>
                                </select>
                            </div>
                            <div>
                                <label>เพศ:</label>
                                <select name="gender" value={formData.gender} onChange={handleInputChange}>
                                    <option value="">เลือกเพศ</option>
                                    <option value="ชาย">ชาย</option>
                                    <option value="หญิง">หญิง</option>
                                </select>
                            </div>
                            <button type="submit" disabled={isLoading}>{isLoading ? 'กำลังโหลด...' : 'วิเคราะห์ชื่อ'}</button>
                        </form>
                    </div>
                );

            default:
                return null;
        }
    };

    const renderResults = () => {
        if (!results || results.length === 0) return null;

        return (
            <div className="results-container">
                <h3 className="text-xl font-bold mb-4">ผลลัพธ์</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.map((result, index) => (
                        <div
                            key={index}
                            className="p-4 border rounded-lg shadow hover:shadow-lg cursor-pointer"
                            onClick={() => {
                                Swal.fire({
                                    title: result.name,
                                    html: `
                                        <div class="text-left">
                                            <p><strong>ความหมาย:</strong> ${result.meaning}</p>
                                            <p><strong>แท็ก:</strong> ${result.tags.join(', ')}</p>
                                            ${result.matchScore ? `<p><strong>คะแนนความเข้ากัน:</strong> ${result.matchScore}</p>` : ''}
                                        </div>
                                    `,
                                    icon: 'info'
                                });
                            }}
                        >
                            <h4 className="font-bold text-lg">{result.name}</h4>
                            <p className="text-gray-600">{result.meaning}</p>
                            {result.matchScore && (
                                <p className="text-sm text-blue-600 mt-2">
                                    คะแนนความเข้ากัน: {result.matchScore}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold mb-4">AI วิเคราะห์และแนะนำชื่อ</h2>
                <div className="flex space-x-4">
                    <button
                        onClick={() => setAnalysisType('recommend')}
                        className={`px-4 py-2 rounded ${
                            analysisType === 'recommend'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200'
                        }`}
                    >
                        แนะนำชื่อ
                    </button>
                    <button
                        onClick={() => setAnalysisType('analyze')}
                        className={`px-4 py-2 rounded ${
                            analysisType === 'analyze'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200'
                        }`}
                    >
                        วิเคราะห์ชื่อ
                    </button>
                    <button
                        onClick={() => setAnalysisType('match')}
                        className={`px-4 py-2 rounded ${
                            analysisType === 'match'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200'
                        }`}
                    >
                        จับคู่ชื่อ
                    </button>
                </div>
            </div>

            {renderForm()}
            {renderResults()}
        </div>
    );
};

export default AINameAnalysis;
