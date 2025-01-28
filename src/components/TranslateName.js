import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Swal from "sweetalert2";
import "./AINameAnalysis.css";

const TranslateName = () => {
  const [name, setName] = useState("");
  const [meaning, setMeaning] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
  
    setIsLoading(true);
  
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
  
      if (data.success) {
        setMeaning(data.meaning);
  
        // บันทึกข้อมูลลง Supabase
        await supabase.from("names").insert({
          name,
          meaning: data.meaning,
          tags: data.tags,
          gender: data.gender,
        });
  
        Swal.fire("แปลความหมายสำเร็จ", `ความหมาย: ${data.meaning}`, "success");
      } else {
        Swal.fire("ไม่สามารถแปลความหมายได้", data.message || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ", "error");
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
              <p>{meaning}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranslateName;