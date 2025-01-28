export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อที่ต้องการแปล' });
  }

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/thainlp/wangchanberta-base-att-spm-uncased",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `ให้ความหมายของชื่อ "${name}" พร้อมสร้างแท็กที่เกี่ยวข้อง 3 อย่างและบอกว่าเหมาะสมกับเพศใด (ชาย, หญิง, หรือใช้ได้ทั้งสอง)`,
        }),
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return res.status(200).json({
      success: true,
      meaning: data[0]?.generated_text || `ความหมายของชื่อ ${name}`,
      tags: ["มงคล", "ความสำเร็จ", "ความสุข"],
      gender: "ทั้งสองเพศ",
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: `เกิดข้อผิดพลาดในการประมวลผล: ${error.message}`,
    });
  }
}