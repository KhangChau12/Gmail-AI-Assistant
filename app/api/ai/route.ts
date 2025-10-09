import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import {
  ClassificationResult,
  SummaryResult,
  ChatResponse,
  ComposeResponse,
  Category,
  EmailAssignment,
  Contact,
  ProcessedEmail,
  AppContext
} from '@/types';
import {
  analyzeEmailsForAgent,
  parseDateQuery,
  getCategories,
  type EmailQueryFilters
} from '@/lib/db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Progress update helper
function createProgressUpdate(step: string, status: 'thinking' | 'processing' | 'completed' | 'error' = 'processing') {
  return {
    type: 'progress',
    step,
    status,
    timestamp: new Date().toISOString()
  };
}

// Classification Agent
async function classifyEmail(
  email: { from: string; subject: string; body: string },
  categories: Category[],
  assignments: EmailAssignment[]
): Promise<ClassificationResult> {
  const prompt = `Phân loại email này vào đúng danh mục.

DANH MỤC HIỆN CÓ:
${categories.map(c => `- ${c.id}: ${c.name} - ${c.description}`).join('\n')}

GHI NHỚ PHÂN LOẠI TRƯỚC:
${assignments.map(a => `- ${a.sender_email} → ${a.category_id}`).join('\n')}

EMAIL CẦN PHÂN LOẠI:
Từ: ${email.from}
Tiêu đề: ${email.subject}
Nội dung: ${email.body.slice(0, 1000)}

Nếu không khớp danh mục nào thì category_id = null`;

  const schema = {
    name: "classification_response",
    schema: {
      type: "object",
      properties: {
        category_id: { 
          type: ["string", "null"],
          description: "ID của danh mục phù hợp hoặc null nếu không khớp"
        },
        confidence: { 
          type: "number", 
          minimum: 0, 
          maximum: 1,
          description: "Độ tin cậy từ 0-1"
        }
      },
      required: ["category_id", "confidence"],
      additionalProperties: false
    }
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: schema
      },
      temperature: 0.1,
      max_tokens: 150
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response content');

    const parsed = JSON.parse(content) as ClassificationResult;
    
    // Validate response
    if (typeof parsed.confidence !== 'number' || parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error('Invalid confidence score');
    }
    
    return parsed;
  } catch (error) {
    console.error('Classification error:', error);
    return { category_id: null, confidence: 0 };
  }
}

// Summary Agent
async function summarizeEmail(emailBody: string): Promise<SummaryResult> {
  // Check if email body is empty or null
  if (!emailBody || emailBody.trim() === '') {
    return { summary: 'Email không có nội dung để tóm tắt.' };
  }

  // Check if content is too short to summarize meaningfully
  if (emailBody.trim().length < 20) {
    return { summary: 'Nội dung email quá ngắn để tóm tắt.' };
  }

  const prompt = `Tóm tắt email này thành 1-2 câu ngắn gọn, súc tích bằng tiếng Việt.

${emailBody.slice(0, 2000)}

Chỉ trả về câu tóm tắt quan trọng nhất, không giải thích gì thêm.`;

  const schema = {
    name: "summary_response",
    schema: {
      type: "object",
      properties: {
        summary: { 
          type: "string",
          description: "Tóm tắt ngắn gọn của email"
        }
      },
      required: ["summary"],
      additionalProperties: false
    }
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: schema
      },
      temperature: 0.3,
      max_tokens: 200
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response content');

    const parsed = JSON.parse(content) as SummaryResult;
    return parsed;
  } catch (error) {
    console.error('Summary error:', error);
    return { summary: 'Không thể tóm tắt email này.' };
  }
}

// Search and Analyze Agent - queries database and provides intelligent analysis
async function searchAndAnalyzeEmails(
  userMessage: string,
  categories: Category[]
): Promise<{
  analysisText: string;
  analysisData: ChatResponse['analysis_data'];
}> {
  try {
    // Parse the user query for filters
    const dateFilters = parseDateQuery(userMessage);
    const normalizedQuery = userMessage.toLowerCase();

    // Build query filters
    const filters: EmailQueryFilters = {
      ...dateFilters,
      limit: 100 // Reasonable limit for analysis
    };

    // Check for read/unread filter
    if (normalizedQuery.includes('chưa đọc') || normalizedQuery.includes('chưa xem')) {
      filters.isRead = false;
    } else if (normalizedQuery.includes('đã đọc') || normalizedQuery.includes('đã xem')) {
      filters.isRead = true;
    }

    // Check for category filter
    const categoryMatch = categories.find(cat =>
      normalizedQuery.includes(cat.name.toLowerCase()) ||
      normalizedQuery.includes(cat.description.toLowerCase())
    );
    if (categoryMatch) {
      filters.categoryId = categoryMatch.id;
    }

    // Check for sender filter
    const senderMatch = normalizedQuery.match(/từ\s+(.+?)(?:\s|$)/);
    if (senderMatch) {
      filters.senderEmail = senderMatch[1].trim();
    }

    console.log('Email query filters:', filters);

    // Get analysis from database
    const analysis = await analyzeEmailsForAgent(filters);

    console.log('Analysis result:', {
      totalEmails: analysis.totalEmails,
      unreadCount: analysis.unreadCount,
      categoriesFound: analysis.categoryBreakdown.length
    });

    // Prepare email summaries for response
    const summaries = analysis.recentEmails.slice(0, 10).map(email => ({
      email_id: email.id,
      subject: email.subject || 'Không có tiêu đề',
      sender: email.sender_name || email.sender_email || 'Không rõ người gửi',
      summary: email.summary || 'Chưa có tóm tắt',
      received_date: email.received_date || email.processed_at,
      is_read: email.is_read
    }));

    // Create analysis data for frontend
    const analysisData: ChatResponse['analysis_data'] = {
      totalEmails: analysis.totalEmails,
      unreadCount: analysis.unreadCount,
      categoryBreakdown: analysis.categoryBreakdown.map(cb => ({
        category: {
          id: cb.category.id,
          name: cb.category.name,
          description: cb.category.description,
          color: cb.category.color
        },
        count: cb.count,
        unreadCount: cb.unreadCount
      })),
      topSenders: analysis.topSenders,
      insights: analysis.insights,
      summaries
    };

    // Generate intelligent analysis text using AI
    const contextPrompt = `Dựa vào kết quả tìm kiếm email, hãy viết một phân tích thông minh và hữu ích bằng tiếng Việt.

YÊU CẦU TÌM KIẾM: ${userMessage}

KẾT QUẢ TÌM KIẾM:
- Tổng số email: ${analysis.totalEmails}
- Email chưa đọc: ${analysis.unreadCount}
- Các danh mục được tìm thấy: ${analysis.categoryBreakdown.map(cb => `${cb.category.name} (${cb.count})`).join(', ') || 'Không có'}
- Người gửi nhiều nhất: ${analysis.topSenders.slice(0, 3).map(s => `${s.name || s.email} (${s.count})`).join(', ') || 'Không có'}

INSIGHTS TỰ ĐỘNG:
${analysis.insights.join('\n')}

EMAIL GẦN ĐÂY NHẤT (${Math.min(5, analysis.recentEmails.length)} email):
${analysis.recentEmails.slice(0, 5).map(email =>
`- ${email.subject || 'Không có tiêu đề'} từ ${email.sender_name || email.sender_email} (${email.is_read ? 'Đã đọc' : 'Chưa đọc'})`
).join('\n')}

Hãy viết phân tích ngắn gọn, súc tích, tập trung vào thông tin quan trọng nhất cho người dùng. Nếu không tìm thấy email nào, hãy giải thích tại sao và gợi ý người dùng thử tìm kiếm khác.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: contextPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const analysisText = completion.choices[0].message.content ||
      `Tìm thấy ${analysis.totalEmails} email. ${analysis.insights.join(' ')}`;

    return {
      analysisText,
      analysisData
    };

  } catch (error) {
    console.error('Search and analyze error:', error);
    return {
      analysisText: 'Xin lỗi, tôi gặp lỗi khi tìm kiếm và phân tích email. Vui lòng thử lại.',
      analysisData: {
        totalEmails: 0,
        unreadCount: 0,
        categoryBreakdown: [],
        topSenders: [],
        insights: ['Gặp lỗi khi truy vấn dữ liệu'],
        summaries: []
      }
    };
  }
}

// Enhanced Chat Agent with thinking process
async function processChat(
  userMessage: string,
  context: AppContext,
  emailSummary: any,
  contacts: Contact[],
  progressCallback?: (update: any) => void
): Promise<ChatResponse> {
  const sendProgress = (step: string, status: 'thinking' | 'processing' | 'completed' | 'error' = 'processing') => {
    if (progressCallback) {
      progressCallback(createProgressUpdate(step, status));
    }
  };

  try {
    sendProgress('Đang phân tích yêu cầu của bạn', 'thinking');

    // Check if this is a search/analyze request first
    const normalizedMessage = userMessage.toLowerCase();
    const isSearchAndAnalyzeRequest = (
      normalizedMessage.includes('tóm tắt') ||
      normalizedMessage.includes('tìm kiếm') ||
      normalizedMessage.includes('tìm email') ||
      normalizedMessage.includes('email') && (
        normalizedMessage.includes('hôm nay') ||
        normalizedMessage.includes('hôm qua') ||
        normalizedMessage.includes('tuần này') ||
        normalizedMessage.includes('tháng này') ||
        normalizedMessage.includes('chưa đọc') ||
        normalizedMessage.includes('từ ') ||
        normalizedMessage.match(/\d{1,2}\/\d{1,2}\/\d{4}/)
      )
    );

    if (isSearchAndAnalyzeRequest) {
      sendProgress('Đã phát hiện yêu cầu tìm kiếm và phân tích email', 'completed');
      sendProgress('Đang truy vấn cơ sở dữ liệu email', 'processing');

      // Get categories for search
      const categories = await getCategories();

      sendProgress('Đang phân tích và tóm tắt kết quả', 'processing');

      // Perform search and analysis
      const { analysisText, analysisData } = await searchAndAnalyzeEmails(userMessage, categories);

      sendProgress('Hoàn thành phân tích email', 'completed');

      return {
        response_text: analysisText,
        action: 'searchAndAnalyze' as const,
        analysis_data: analysisData
      };
    }

    // Analyze user intent for other requests
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate thinking time
    sendProgress('Đã hiểu yêu cầu - xử lý thông tin ngữ cảnh', 'completed');

    sendProgress('Đang thu thập thông tin từ hệ thống', 'processing');
    
    // Check if user is asking about specific contacts
    const mentionedContacts = contacts.filter(contact => 
      contact.aliases.some(alias => 
        userMessage.toLowerCase().includes(alias.toLowerCase())
      ) || userMessage.toLowerCase().includes(contact.name.toLowerCase())
    );
    
    if (mentionedContacts.length > 0) {
      sendProgress(`Tìm thấy ${mentionedContacts.length} người trong danh bạ`, 'completed');
    }
    
    sendProgress('Đang chuẩn bị câu trả lời với AI', 'processing');

    const prompt = `Bạn là trợ lý AI quản lý email Gmail qua IMAP. Xử lý yêu cầu người dùng bằng tiếng Việt.

NGỮ CẢNH HIỆN TẠI:
- Trang: ${context.currentPage}
- Email đang xem: ${context.currentEmail ? `${context.currentEmail.subject} từ ${context.currentEmail.sender_email}` : 'Không có'}
- Nháp đang soạn: ${context.currentDraft ? context.currentDraft.subject : 'Không có'}
- Gmail folders: ${context.gmailFolders.map(f => f.name).join(', ')}

TÌNH TRẠNG INBOX:
Tổng số email: ${emailSummary.total || 0}
Chưa đọc: ${emailSummary.unread || 0}
Đã đọc: ${(emailSummary.total || 0) - (emailSummary.unread || 0)}

DANH BẠ:
${contacts.map(c => `- ${c.name} (${c.email}) - biệt danh: ${c.aliases.join(', ')}`).join('\n')}

NGƯỜI ĐƯỢC NHẮC ĐẾN:
${mentionedContacts.map(c => `- ${c.name} (${c.email})`).join('\n') || 'Không có'}

YÊU CẦU CỦA NGƯỜI DÙNG: ${userMessage}

QUAN TRỌNG - HIỂU YÊU CẦU TÓM TẮT EMAIL:
- Nếu người dùng nói "tóm tắt tất cả email", "tóm tắt toàn bộ email", "tóm tắt các email tôi nhận được" → tóm tắt TẤT CẢ email (${emailSummary.total || 0} email)
- Nếu người dùng nói "tóm tắt email chưa đọc", "tóm tắt email mới" → chỉ tóm tắt email chưa đọc (${emailSummary.unread || 0} email)
- Mặc định khi không rõ ràng → tóm tắt TẤT CẢ email

Hãy hiểu yêu cầu và đưa ra hành động phù hợp:
- "navigate": chuyển trang
- "compose": soạn email mới
- "search": tìm kiếm email (dùng để tóm tắt email)
- "sync": đồng bộ thư mục
- "none": chỉ trả lời, không hành động`;

    const schema = {
      name: "chat_response",
      schema: {
        type: "object",
        properties: {
          response_text: { 
            type: "string",
            description: "Câu trả lời cho người dùng"
          },
          action: {
            type: "string",
            enum: ["navigate", "compose", "search", "sync", "searchAndAnalyze", "none"],
            description: "Hành động cần thực hiện"
          },
          navigation_url: { 
            type: ["string", "null"],
            description: "URL để chuyển hướng nếu action là navigate"
          },
          compose_data: { 
            type: ["object", "null"],
            properties: {
              to_email: { type: ["string", "null"] },
              to_name: { type: ["string", "null"] },
              subject: { type: ["string", "null"] }
            },
            description: "Dữ liệu cho việc soạn email nếu action là compose"
          },
          search_params: { 
            type: ["object", "null"],
            properties: {
              query: { type: "string" },
              category_id: { type: ["string", "null"] }
            },
            description: "Tham số tìm kiếm nếu action là search"
          },
          sync_folder: { 
            type: ["string", "null"],
            description: "Thư mục cần đồng bộ nếu action là sync"
          }
        },
        required: ["response_text", "action"],
        additionalProperties: false
      }
    };

    sendProgress('Đang xử lý với OpenAI GPT-4o-mini', 'processing');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: schema
      },
      temperature: 0.7,
      max_tokens: 500
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response content');

    sendProgress('Đang xử lý và kiểm tra kết quả', 'processing');
    
    const parsed = JSON.parse(content) as ChatResponse;
    
    sendProgress('Hoàn thành xử lý - chuẩn bị phản hồi', 'completed');
    
    return parsed;
  } catch (error) {
    console.error('Chat error:', error);
    sendProgress('Gặp lỗi khi xử lý - sử dụng phản hồi dự phòng', 'error');
    return {
      response_text: 'Xin lỗi, tôi không thể xử lý yêu cầu này lúc này.',
      action: 'none'
    };
  }
}

// Enhanced Compose Chat Agent - returns structured response with dialogue and email content
async function processComposeChat(
  userMessage: string,
  currentDraft: any,
  replyToEmail?: ProcessedEmail,
  conversationHistory: any[] = []
): Promise<{ dialogue: string; emailContent: { subject: string; body: string } }> {
  // Build conversation context
  const conversationContext = conversationHistory
    .slice(-5) // Keep last 5 messages for context
    .map(msg => `${msg.isUser ? 'Người dùng' : 'AI'}: ${msg.text}`)
    .join('\n');

  let prompt = `Bạn là trợ lý AI chuyên soạn email. Hãy trả lời người dùng và đề xuất nội dung email dựa trên yêu cầu.

QUAN TRỌNG: Bạn phải trả về phản hồi theo định dạng chính xác sau:
<ans>
[Câu trả lời của bạn với người dùng - giải thích những gì bạn đang làm]
</ans>
<mail>
[Nội dung email được đề xuất]
</mail>

NGỮ CẢNH HỘI THOẠI TRƯỚC:
${conversationContext}

NHÁP HIỆN TẠI:
Người nhận: ${currentDraft.to_email || 'Chưa có'}
Tiêu đề: ${currentDraft.subject || 'Chưa có'}
Nội dung: ${currentDraft.body || 'Chưa có'}`;

  if (replyToEmail) {
    prompt += `

EMAIL ĐANG TRẢ LỜI:
Từ: ${replyToEmail.sender_name || replyToEmail.sender_email}
Tiêu đề: ${replyToEmail.subject}
Nội dung: ${replyToEmail.body_text?.slice(0, 500) || 'Không có nội dung'}...`;
  }

  prompt += `

YÊU CẦU CỦA NGƯỜI DÙNG: ${userMessage}

Hãy:
1. Trong phần <ans>: Giải thích bạn hiểu yêu cầu như thế nào và sẽ làm gì
2. Trong phần <mail>: Đưa ra nội dung email hoàn chỉnh (Subject: + Body:)

Viết email bằng tiếng Việt, lịch sự và chuyên nghiệp.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1000
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response content');

    // Parse the structured response
    const answerMatch = content.match(/<ans>([\s\S]*?)<\/ans>/);
    const mailMatch = content.match(/<mail>([\s\S]*?)<\/mail>/);

    let dialogue = answerMatch ? answerMatch[1].trim() : content;
    let emailContent = { subject: '', body: '' };

    if (mailMatch) {
      const emailText = mailMatch[1].trim();
      const subjectMatch = emailText.match(/Subject:\s*(.*?)(?:\n|$)/i);
      const bodyMatch = emailText.match(/(?:Body:|Subject:.*?\n)([\s\S]*)/i);

      if (subjectMatch) {
        emailContent.subject = subjectMatch[1].trim();
      }
      if (bodyMatch) {
        emailContent.body = bodyMatch[1].trim();
      } else if (!subjectMatch && emailText) {
        // If no explicit Subject/Body labels, treat whole content as body
        emailContent.body = emailText;
      }
    }

    return { dialogue, emailContent };
  } catch (error) {
    console.error('Compose chat error:', error);
    return {
      dialogue: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại.',
      emailContent: { subject: '', body: '' }
    };
  }
}

// Compose Agent
async function composeEmail(
  request: string,
  type: 'new' | 'reply' | 'edit',
  originalEmail?: ProcessedEmail,
  currentDraft?: any
): Promise<ComposeResponse> {
  let prompt = `Soạn email theo yêu cầu cụ thể bằng tiếng Việt.

LOẠI TASK: ${type}`;

  if (type === 'reply' && originalEmail) {
    prompt += `

EMAIL GỐC:
Từ: ${originalEmail.sender_email}
Tiêu đề: ${originalEmail.subject}
Nội dung: ${originalEmail.body_text?.slice(0, 1000) || 'Không có nội dung'}`;
  }

  if (type === 'edit' && currentDraft) {
    prompt += `

NHÁP HIỆN TẠI:
Tiêu đề: ${currentDraft.subject}
Nội dung: ${currentDraft.body}`;
  }

  prompt += `

YÊU CẦU: ${request}

QUAN TRỌNG:
- response_text: câu trả lời hiển thị trong chat box
- subject + body: nội dung email hiển thị trong draft editor
- Viết email lịch sự, chuyên nghiệp bằng tiếng Việt`;

  const schema = {
    name: "compose_response",
    schema: {
      type: "object",
      properties: {
        response_text: { 
          type: "string",
          description: "Câu trả lời cho người dùng về việc soạn email"
        },
        subject: { 
          type: "string",
          description: "Tiêu đề email"
        },
        body: { 
          type: "string",
          description: "Nội dung email"
        }
      },
      required: ["response_text", "subject", "body"],
      additionalProperties: false
    }
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: schema
      },
      temperature: 0.8,
      max_tokens: 800
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response content');

    const parsed = JSON.parse(content) as ComposeResponse;
    return parsed;
  } catch (error) {
    console.error('Compose error:', error);
    return {
      response_text: 'Xin lỗi, tôi không thể soạn email này lúc này.',
      subject: 'Email mới',
      body: 'Nội dung email...'
    };
  }
}

// Streaming API Route Handler for Chat
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...params } = body;

    // Handle chat with streaming progress
    if (type === 'chat') {
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        start(controller) {
          const progressCallback = (update: any) => {
            const data = `data: ${JSON.stringify(update)}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          processChat(
            params.userMessage,
            params.context,
            params.emailSummary,
            params.contacts || [],
            progressCallback
          ).then(result => {
            // Send final result
            const finalData = `data: ${JSON.stringify({ type: 'final', ...result })}\n\n`;
            controller.enqueue(encoder.encode(finalData));
            controller.close();
          }).catch(error => {
            const errorData = `data: ${JSON.stringify({ 
              type: 'error', 
              error: 'Internal server error' 
            })}\n\n`;
            controller.enqueue(encoder.encode(errorData));
            controller.close();
          });
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Handle other agent types normally
    switch (type) {
      case 'classify':
        const classificationResult = await classifyEmail(
          params.email,
          params.categories || [],
          params.assignments || []
        );
        return NextResponse.json(classificationResult);

      case 'summarize':
        const summaryResult = await summarizeEmail(params.emailBody);
        return NextResponse.json(summaryResult);

      case 'compose':
        const composeResult = await composeEmail(
          params.request,
          params.composeType || 'new',
          params.originalEmail,
          params.currentDraft
        );
        return NextResponse.json(composeResult);

      case 'compose-chat':
        const composeChatResult = await processComposeChat(
          params.userMessage,
          params.currentDraft || {},
          params.replyToEmail,
          params.conversationHistory || []
        );
        return NextResponse.json(composeChatResult);

      default:
        return NextResponse.json(
          { error: 'Invalid AI agent type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}