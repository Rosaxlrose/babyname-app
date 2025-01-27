export default async function handler(req, res) {
  console.log(`Request method: ${req.method}`);
  console.log('HUGGINGFACE_API_KEY:', process.env.HUGGINGFACE_API_KEY); // สำหรับการตรวจสอบ

  if (req.method !== "POST") {
      res.status(405).json({ success: false, message: "Method not allowed" });
      return;
  }

  // ตรวจสอบว่า body มีข้อมูลที่จำเป็นหรือไม่
  const { name } = req.body;
  if (!name) {
      res.status(400).json({ success: false, message: "Name is required" });
      return;
  }

  try {
      // รหัสที่เชื่อมต่อกับ Hugging Face API
      const response = await fetch("https://api-inference.huggingface.co/models/thainlp/wangchanberta-base-att-spm-uncased", {
          method: "POST",
          headers: {
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: name }),
      });

      const data = await response.json();
      res.status(200).json({ success: true, data });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}