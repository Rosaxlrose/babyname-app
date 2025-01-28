import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import "./AINameAnalysis.css";

const TranslateName = () => {
  const [name, setName] = useState("");
  const [meaning, setMeaning] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    const getApiKey = async () => {
      try {
        const { data, error } = await supabase.rpc("get_secret", {
          secret_name: "OPENAI_API_KEY",
        });

        if (error) {
          console.error("Error fetching API key:", error);
          return;
        }

        if (data) {
          setApiKey(data);
        } else {
          console.error("No API key found");
        }
      } catch (error) {
        console.error("Error in getApiKey:", error);
      }
    };

    getApiKey();
  }, []);

  const parseAIResponse = (response) => {
    try {
      const meaningMatch = response.match(/ความหมาย:?\s*(.+?)(?=\n|แท็ก|เพศ|$)/i);
      const tagsMatch = response.match(/แท็ก:?\s*(.+?)(?=\n|เพศ|$)/i);
      const genderMatch = response.match(/เพศ:?\s*(.+?)(?=\n|$)/i);

      let gender = "ใช้ได้กับทั้งสอง";
      if (genderMatch) {
        const genderText = genderMatch[1].trim().toLowerCase();
        if (genderText.includes("ชาย") && !genderText.includes("หญิง")) {
          gender = "ชาย";
        } else if (genderText.includes("หญิง") && !genderText.includes("ชาย")) {
          gender = "หญิง";
        }
      }

      return {
        meaning: meaningMatch ? meaningMatch[1].trim() : response,
        tags: tagsMatch
          ? tagsMatch[1]
              .split(/[,،]/)
              .map((tag) => tag.trim())
              .filter((tag) => tag)
          : [],
        gender,
      };
    } catch (error) {
      console.error("Error parsing AI response:", error);
      return {
        meaning: response,
        tags: [],
        gender: "ใช้ได้กับทั้งสอง",
      };
    }
  };

  const handleTranslate = async () => {
    if (!name) {
      Swal.fire("กรุณากรอกชื่อ");
      return;
    }
  
    setIsLoading(true);
  
    try {
      // ตรวจสอบ cache ใน localStorage ก่อน
      const cachedResult = localStorage.getItem(`name-${name}`);
      if (cachedResult) {
        const { meaning } = JSON.parse(cachedResult);
        setMeaning(meaning);
        Swal.fire("ผลลัพธ์จาก cache", `ความหมาย: ${meaning}`, "info");
        return;
      }
  
      // ตรวจสอบจากฐานข้อมูล
      const { data: existingName, error: fetchError } = await supabase
        .from("names")
        .select("meaning")
        .eq("name", name)
        .single();
  
      if (!fetchError && existingName) {
        // เก็บผลลัพธ์ใน cache
        localStorage.setItem(`name-${name}`, JSON.stringify(existingName));
        setMeaning(existingName.meaning);
        Swal.fire("ผลลัพธ์จากฐานข้อมูล", `ความหมาย: ${existingName.meaning}`, "info");
        return;
      }
  
      // เรียก AI API หากไม่มีในฐานข้อมูลหรือ cache
      if (!apiKey) {
        Swal.fire(
          "ข้อผิดพลาด",
          "ไม่พบ API key กรุณาตั้งค่า OPENAI_API_KEY ใน Supabase secrets",
          "error"
        );
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
              role: "user",
              content: `วิเคราะห์ชื่อต่อไปนี้:
              ชื่อ: "${name}"
              กรุณาตอบในรูปแบบ:
              ความหมาย: [ความหมายของชื่อ]
              แท็ก: [แท็ก1], [แท็ก2], [แท็ก3]
              เพศ: [ตอบเฉพาะคำว่า "ชาย" หรือ "หญิง" หรือ "ใช้ได้กับทั้งสอง" เท่านั้น]`,
            },
          ],
          max_tokens: 100,
          temperature: 0.7,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content.trim();
      const parsedResponse = parseAIResponse(aiResponse);
  
      // เก็บผลลัพธ์ลงฐานข้อมูลและ cache
      const { error: dbError } = await supabase.from("names").insert({
        name,
        meaning: parsedResponse.meaning,
        tags: parsedResponse.tags,
        gender: parsedResponse.gender,
      });
  
      if (dbError) {
        console.error("Database Error:", dbError);
      }
  
      localStorage.setItem(
        `name-${name}`,
        JSON.stringify({
          name,
          meaning: parsedResponse.meaning,
        })
      );
  
      setMeaning(parsedResponse.meaning);
      Swal.fire("แปลความหมายสำเร็จ", `ความหมาย: ${parsedResponse.meaning}`, "success");
    } catch (error) {
      console.error("Error:", error);
      Swal.fire("เกิดข้อผิดพลาด", `ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-name-analysis-container">
      <div className="glass-container max-w-full lg:max-w-4xl mx-auto w-[95%]">
        <h2 className="form-title">
          <span className="star">🤖</span> แปลความหมายชื่อ
        </h2>
        <div className="space-y-6">
          <div className="flex justify-between">
  <label className="block text-sm font-medium text-gray-700">ชื่อภาษาไทย</label>
  <label className="block text-sm font-medium text-gray-700 text-right">Powered by GPT-4o-mini</label>
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
          {meaning && (
            <div className="mt-6">
              <h3 className="text-xl font-bold">ผลลัพธ์</h3>
              <p>ชื่อ: {name}</p>
              <p>ความหมาย: {meaning}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranslateName;
