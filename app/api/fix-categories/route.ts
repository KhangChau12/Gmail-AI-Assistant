import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    // Fix "Công việc" to be more inclusive of competitions
    const { error: congViecError } = await supabase
      .from('categories')
      .update({ 
        description: 'Email liên quan đến công việc, thi cử, cuộc thi, dự án, hội thảo, workshop, meeting, báo cáo từ đồng nghiệp, sếp, hoặc tổ chức bên ngoài (không phải từ @ptnk.edu.vn)' 
      })
      .eq('name', 'Công việc');

    if (congViecError) throw congViecError;

    // Fix "Nhà trường" to be very specific - ONLY from PTNK
    const { error: nhaTruongError } = await supabase
      .from('categories')
      .update({ 
        description: 'CHỈ dành cho email được gửi TỪ các địa chỉ @ptnk.edu.vn (ví dụ: trolythanhnien@ptnk.edu.vn, phattrienctdt@ptnk.edu.vn). KHÔNG bao gồm email từ tổ chức khác dù có liên quan đến giáo dục.' 
      })
      .eq('name', 'Nhà trường');

    if (nhaTruongError) throw nhaTruongError;

    // Get updated categories to verify
    const { data: categories, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) throw fetchError;

    return NextResponse.json({ 
      success: true, 
      message: 'Categories updated successfully',
      categories: categories?.map(c => ({
        name: c.name,
        description: c.description
      }))
    });
  } catch (error) {
    console.error('Fix categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fix categories', details: error.message },
      { status: 500 }
    );
  }
}