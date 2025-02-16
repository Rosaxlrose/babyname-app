import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import NameMeaningResult from "../components/NameMeaningResult";
import "./AINameAnalysis.css";

const TranslateName = () => {
  const [name, setName] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [previousSearch, setPreviousSearch] = useState("");

  useEffect(() => {
    const container = document.querySelector('.translate-name-container');
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

    const getApiKey = async () => {
      try {
        const { data, error } = await supabase.rpc("get_secret", {
          secret_name: "OPENAI_API_KEY",
        });

        if (error) {
          console.error("Error fetching API key:", error);
          Swal.fire("ข้อผิดพลาด", "ไม่สามารถดึง API key ได้", "error");
          return;
        }

        if (data) {
          setApiKey(data);
        } else {
          Swal.fire(
            "ข้อผิดพลาด",
            "กรุณาตั้งค่า OPENAI_API_KEY ใน Supabase secrets",
            "error"
          );
        }
      } catch (error) {
        console.error("Error in getApiKey:", error);
        Swal.fire("ข้อผิดพลาด", "เกิดข้อผิดพลาดในการดึง API key", "error");
      }
    };

    getApiKey();
  }, []);

  const parseAIResponse = (response) => {
    try {
      const meaningMatch = response.match(/ความหมาย:?\s*(.+?)(?=\n|แท็ก|เพศ|$)/i);
      const tagsMatch = response.match(/แท็ก:?\s*(.+?)(?=\n|เพศ|$)/i);
      const genderMatch = response.match(/เพศ:?\s*(.+?)(?=\n|$)/i);

      let gender = "ไม่ระบุ";
      if (genderMatch) {
        const genderText = genderMatch[1].trim().toLowerCase();
        if (genderText.includes("ชาย") && !genderText.includes("หญิง") && !genderText.includes("ทั้ง")) {
          gender = "ชาย";
        } else if (genderText.includes("หญิง") && !genderText.includes("ชาย") && !genderText.includes("ทั้ง")) {
          gender = "หญิง";
        } else if (genderText.includes("ทั้งสอง") || genderText.includes("ทั้ง")) {
          gender = "ใช้ได้กับทั้งสอง";
        }
      }

      let cleanedMeaning = meaningMatch ? meaningMatch[1].trim() : response;
      cleanedMeaning = cleanedMeaning
        .replace(/^["']|["']$/g, '')
        .replace(/ชื่อ\s*["']?[^"']+["']?\s*(?:มีความหมายว่า|หมายถึง|คือ)\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      return {
        meaning: cleanedMeaning,
        tags: tagsMatch
          ? tagsMatch[1]
              .split(/[,،]/)
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0)
          : [],
        gender,
      };
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return {
        meaning: response,
        tags: [],
        gender: "ไม่ระบุ",
      };
    }
  };

  const handleTranslate = async () => {
    if (!name) {
      Swal.fire("กรุณากรอกชื่อ");
      return;
    }

    if (!apiKey) {
      Swal.fire(
        "ข้อผิดพลาด",
        "กรุณาตั้งค่า OPENAI_API_KEY ใน Supabase secrets ก่อนใช้งาน",
        "error"
      );
      return;
    }

    if (name === previousSearch && searchResult) {
      // ถ้าค้นหาชื่อเดิม ให้แสดงผลใหม่
      setSearchResult(null);
      setTimeout(() => setSearchResult(searchResult), 100);
      return;
    }

    setIsLoading(true);
    setPreviousSearch(name);

    try {
      const cachedResult = localStorage.getItem(`name-${name}`);
      if (cachedResult) {
        const parsedResult = JSON.parse(cachedResult);
        setSearchResult(null);
        setTimeout(() => setSearchResult({
          ...parsedResult,
          name: name 
        }), 100);
        setIsLoading(false);
        return;
      }

      // เช็คจากฐานข้อมูลก่อน
      const { data: existingName, error: fetchError } = await supabase
        .from("names")
        .select("name, meaning, gender, tags")
        .eq("name", name)
        .single();

      if (!fetchError && existingName) {
        const result = {
          name: name, 
          meaning: existingName.meaning,
          tags: existingName.tags || [],
          gender: existingName.gender || '',
        };
        localStorage.setItem(`name-${name}`, JSON.stringify(result));
        setSearchResult(null);
        setTimeout(() => setSearchResult(result), 100);
        setIsLoading(false);
        return;
      }

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `คุณเป็นผู้เชี่ยวชาญด้านการตั้งชื่อและความหมายของชื่อในภาษาไทย 
              กรุณาวิเคราะห์ชื่อโดยละเอียดในด้าน:
              1. ความหมายที่แท้จริงของชื่อ (ตอบเฉพาะความหมาย ไม่ต้องมีคำว่า "ชื่อ" หรือ "หมายถึง") โดยให้อ้างอิงความหมายที่ตรงกับพจนานุกรมไทยไว้ก่อน
              1.1 ให้ตรวจสอบชื่อที่เป็นคำผสมด้วย หากมีให้แยกความหมายของแต่ละคำ
              1.2 ให้ตรวจสอบความหมายของคำที่เป็นคำสมุทร หากมีให้แยกความหมายของแต่ละคำ
              2. แท็กที่เกี่ยวข้องกับความหมายและลักษณะของชื่อ
              3. เพศที่เหมาะสมกับชื่อนี้ (ต้องระบุให้ชัดเจนว่าเหมาะกับเพศใด)
              
              โปรดตอบในรูปแบบที่กำหนดเท่านั้น ห้ามเพิ่มข้อมูลอื่น`
            },
            {
              role: "user",
              content: `วิเคราะห์ชื่อ: "${name}"
              
              กรุณาตอบในรูปแบบต่อไปนี้เท่านั้น:
              ความหมาย: [อธิบายความหมายโดยตรง ไม่ต้องมีคำว่า "ชื่อ" หรือ "หมายถึง"]
              แท็ก: [แท็ก1], [แท็ก2], [แท็ก3]
              เพศ: [ตอบเพียง "ชาย" หรือ "หญิง" หรือ "ใช้ได้ทั้งสองเพศ" เท่านั้น]`
            }
          ],
          temperature: 0.5,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content.trim();
      const parsedResponse = parseAIResponse(aiResponse);
      
      const result = {
        name,
        meaning: parsedResponse.meaning,
        tags: parsedResponse.tags,
        gender: parsedResponse.gender,
      };

      const { error: dbError } = await supabase.from("names").insert({
        ...result,
        created_at: new Date().toISOString(),
      });

      if (dbError) {
        console.error("Database Error:", dbError);
      }

      localStorage.setItem(`name-${name}`, JSON.stringify(result));
      setSearchResult(result);

    } catch (error) {
      console.error("Error:", error);
      Swal.fire(
        "เกิดข้อผิดพลาด",
        `ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ${error.message}`,
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="translate-name-container relative min-h-screen">
      <div className="glass-container max-w-full lg:max-w-4xl mx-auto w-[95%] relative z-10">
        <h2 className="form-title">
          <span className="star">🤖</span> แปลความหมายชื่อ
        </h2>
        <div className="space-y-6">
          <div className="flex justify-between">
            <label className="block text-sm font-medium text-gray-700">ชื่อภาษาไทย</label>
            <label className="block text-sm font-medium text-gray-700 text-right">Powered by GPT-3.5</label>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="กรอกชื่อที่ต้องการแปล"
            className="form-input"
          />
          <button
            onClick={handleTranslate}
            disabled={isLoading}
            className="btn btn-primary"
          >
            {isLoading ? "⏳ กำลังแปล..." : "🔍 แปลความหมาย"}
          </button>
          
          {searchResult && (
            <NameMeaningResult 
              name={searchResult.name}
              meaning={searchResult.meaning}
              tags={searchResult.tags}
              gender={searchResult.gender}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default TranslateName;