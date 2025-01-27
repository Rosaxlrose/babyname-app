export default async function handler(req, res) {
    console.log(`Request method: ${req.method}`); // เช็ค method ชัดเจน
  
    if (req.method !== "POST") {
      res.status(405).json({ success: false, message: "Method not allowed" });
      return;
    }
  
    const { name } = req.body;
  
    if (!name) {
      res.status(400).json({ success: false, message: "Missing name" });
      return;
    }
  
    try {
      // ตรวจ API และ method ให้ถูกต้องเสมอ
      const response = await fetch("https://api-inference.huggingface.co/models/thainlp/wangchanberta-base-att-spm-uncased", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `ให้ความหมายของชื่อ "${name}" พร้อมสร้างแท็กที่เกี่ยวข้อง 3 อย่างและบอกว่าเหมาะสมกับเพศใด (ชาย, หญิง, หรือใช้ได้ทั้งสอง)`,
        }),
      });
  
      const result = await response.json();
  
      if (result.error) {
        throw new Error(result.error);
      }
  
      res.status(200).json({
        success: true,
        meaning: `ความหมายของชื่อ ${name}`,
        tags: ["สุขภาพ", "ความสำเร็จ", "มงคล"], // ตัวอย่าง
        gender: "ชาย", // ตัวอย่าง
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
  