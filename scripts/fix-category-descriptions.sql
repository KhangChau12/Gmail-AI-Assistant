-- Fix category descriptions to clarify the boundaries between categories

UPDATE categories SET description = 'Email liên quan đến công việc, thi cử, dự án, cuộc họp, meeting, báo cáo, cuộc thi, hội thảo từ đồng nghiệp, sếp, tổ chức bên ngoài' WHERE name = 'Công việc';

UPDATE categories SET description = 'Chỉ những thông báo chính thức được GỬI TỪ TRƯỜNG PTNK (từ các email có đuôi @ptnk.edu.vn như trolythanhnien@ptnk.edu.vn, phattrienctdt@ptnk.edu.vn, v.v.)' WHERE name = 'Nhà trường';

-- Show updated categories for verification
SELECT id, name, description FROM categories ORDER BY name;