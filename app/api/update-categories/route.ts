import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Update Công việc category
    await supabase
      .from('categories')
      .update({ 
        description: 'Email liên quan đến công việc, thi cử, dự án, cuộc họp, meeting, báo cáo, cuộc thi, hội thảo, workshop từ đồng nghiệp, sếp, hoặc tổ chức bên ngoài (không phải trường PTNK)' 
      })
      .eq('name', 'Công việc');

    // Update Nhà trường category  
    await supabase
      .from('categories')
      .update({ 
        description: 'CHỈ những thông báo chính thức được GỬI TỪ TRƯỜNG PTNK (từ các email có đuôi @ptnk.edu.vn như trolythanhnien@ptnk.edu.vn, phattrienctdt@ptnk.edu.vn, v.v.)' 
      })
      .eq('name', 'Nhà trường');

    return NextResponse.json({ success: true, message: 'Categories updated successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update categories', details: error },
      { status: 500 }
    );
  }
}