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
        const { data, error } = await supabase.rpc('get_secret', { 
          secret_name: 'OPENAI_API_KEY' 
        });
        
        if (error) {
          console.error('Error fetching API key:', error);
          return;
        }
        
        if (data) {
          console.log('API key retrieved successfully');
          setApiKey(data);
        } else {
          console.error('No API key found');
        }
      } catch (error) {
        console.error('Error in getApiKey:', error);
      }
    };
    
    getApiKey();
  }, []);

  useEffect(() => {
    const container = document.querySelector(".ai-name-analysis-container");
    if (container) {
      const existingBubbles = container.querySelectorAll(".ai-floating-bubble");
      existingBubbles.forEach((bubble) => bubble.remove());

      for (let i = 0; i < 6; i++) {
        const bubble = document.createElement("div");
        bubble.className = "ai-floating-bubble";
        bubble.style.width = `${Math.random() * 100 + 50}px`;
        bubble.style.height = bubble.style.width;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.top = `${Math.random() * 100}%`;
        bubble.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(bubble);
      }
    }
  }, []);

  const handleTranslate = async () => {
    if (!name) {
      Swal.fire("กรุณากรอกชื่อ");
      return;
    }
  
    if (!apiKey) {
      Swal.fire("ข้อผิดพลาด", "ไม่พบ API key กรุณาตั้งค่า OPENAI_API_KEY ใน Supabase secrets", "error");
      return;
    }
  
    setIsLoading(true);
  
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{
            role: "user",
            content: `ให้ความหมายของชื่อ "${name}" พร้อมสร้างแท็กที่เกี่ยวข้อง 3 อย่าง และบอกว่าเหมาะสมกับเพศใด (ให้ระบเุเป็น ชาย, หญิง, หรือใช้ได้กับทั้งสอง (ไม่ต้องใส่คำว่าเพศ))`
          }],
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data.choices && data.choices[0]?.message?.content) {
        const meaning = data.choices[0].message.content.trim();
        setMeaning(meaning);
  
        await supabase.from("names").insert({
          name,
          meaning: meaning,
          tags: ["มงคล", "ความสำเร็จ", "ความสุข"],
          gender: "ทั้งสองเพศ",
        });
  
        Swal.fire("แปลความหมายสำเร็จ", `ความหมาย: ${meaning}`, "success");
      } else {
        Swal.fire("ไม่สามารถแปลความหมายได้", "ไม่พบข้อมูลการแปล", "error");
      }
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
          <label className="block text-sm font-medium text-gray-700">ชื่อภาษาไทย</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="กรอกชื่อที่ต้องการแปล"
            className="form-input"
            ></input>
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
          <p>{meaning}</p>
        </div>
      )}
    </div>
  </div>
</div>
);

};

export default TranslateName;