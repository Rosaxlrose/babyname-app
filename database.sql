-- Create names table
CREATE TABLE IF NOT EXISTS names (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    meaning TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    added_by_user BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create user_submitted_names table for storing names submitted by users
CREATE TABLE IF NOT EXISTS user_submitted_names (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    meaning TEXT NOT NULL,
    suggested_tags TEXT[] DEFAULT '{}',
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create name_preferences table for storing user preferences for AI analysis
CREATE TABLE IF NOT EXISTS name_preferences (
    id SERIAL PRIMARY KEY,
    father_name TEXT,
    father_meaning TEXT,
    mother_name TEXT,
    mother_meaning TEXT,
    desired_meaning TEXT,
    desired_characteristics TEXT[],
    baby_gender TEXT CHECK (baby_gender IN ('ชาย', 'หญิง')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create ai_training_data table for storing training data
CREATE TABLE IF NOT EXISTS ai_training_data (
    id SERIAL PRIMARY KEY,
    input_text TEXT NOT NULL,
    tags TEXT[] NOT NULL,
    confidence_score FLOAT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create trigger function for handling approved names
CREATE OR REPLACE FUNCTION handle_approved_names()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.approved = true THEN
        -- Insert into names table
        INSERT INTO names (name, meaning, tags, added_by_user)
        VALUES (NEW.name, NEW.meaning, NEW.suggested_tags, true);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS on_name_approved ON user_submitted_names;
CREATE TRIGGER on_name_approved
    AFTER UPDATE OF approved ON user_submitted_names
    FOR EACH ROW
    WHEN (NEW.approved = true)
    EXECUTE FUNCTION handle_approved_names();

-- Insert sample data
INSERT INTO names (name, meaning, tags) VALUES
('อาทิตย์', 'ดวงอาทิตย์ แสงสว่าง พลังงาน', ARRAY['พลัง', 'ธรรมชาติ', 'แสงสว่าง']),
('ปัญญา', 'ความรู้ ความฉลาด สติปัญญา', ARRAY['ปัญญา', 'ความรู้', 'ความสำเร็จ']),
('ศรัทธา', 'ความเชื่อมั่น ความศรัทธา', ARRAY['ความเชื่อ', 'ศรัทธา', 'จิตใจ']),
('นภา', 'ท้องฟ้า ความกว้างใหญ่', ARRAY['ธรรมชาติ', 'ความสวยงาม']),
('รุ่งเรือง', 'ความเจริญ ความสำเร็จ', ARRAY['ความสำเร็จ', 'ความเจริญ']),
('ชลธาร', 'สายน้ำ ความไหลลื่น', ARRAY['ธรรมชาติ', 'น้ำ', 'ความราบรื่น']),
('กานต์', 'ความรัก ความน่ารัก', ARRAY['ความรัก', 'ความสวยงาม']),
('ภูมิ', 'แผ่นดิน ความมั่นคง', ARRAY['ธรรมชาติ', 'ความมั่นคง']),
('ปรีชา', 'ความฉลาด ความสามารถ', ARRAY['ปัญญา', 'ความสามารถ']),
('วาสนา', 'โชคดี ชะตา', ARRAY['โชคดี', 'ความสำเร็จ']);
