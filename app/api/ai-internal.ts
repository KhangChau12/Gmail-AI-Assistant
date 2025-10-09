import OpenAI from 'openai';
import { 
  ClassificationResult, 
  SummaryResult,
  Category,
  EmailAssignment
} from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Smart content extraction - get only the most important parts for classification
function extractImportantContent(subject: string, body: string): string {
  if (!body || body.length < 50) return '';
  
  // Remove common email fluff
  let content = body
    .replace(/-----Original Message-----[\s\S]*$/i, '')
    .replace(/On .* wrote:[\s\S]*$/i, '')
    .replace(/Sent from my \w+/gi, '')
    .replace(/Best regards?[\s\S]*$/gi, '')
    .replace(/Thank you[\s\S]*$/gi, '')
    .replace(/Sincerely[\s\S]*$/gi, '');
  
  // Get first few sentences or first 400 chars
  const sentences = content.split(/[.!?]+/).slice(0, 3);
  const importantPart = sentences.join('. ').slice(0, 400);
  
  return importantPart.trim();
}

// Classification Agent - Internal version  
export async function classifyEmail(
  email: { from: string; subject: string; body: string },
  categories: Category[],
  assignments: EmailAssignment[]
): Promise<ClassificationResult | null> {
  

  // Smart content extraction - focus on important parts only
  const smartContent = extractImportantContent(email.subject, email.body);
  
  const prompt = `Phân loại email vào danh mục phù hợp:

DANH MỤC:
${categories.map(c => `${c.id}: ${c.name} - ${c.description}`).join('\n')}

EMAIL:
Từ: ${email.from}
Tiêu đề: ${email.subject}
${smartContent.length > 0 ? `Nội dung: ${smartContent}` : ''}

Trả về 1-2 danh mục phù hợp nhất với confidence >= 0.6.`;

  const schema = {
    name: "classification_response",
    schema: {
      type: "object",
      properties: {
        categories: {
          type: "array",
          maxItems: 2, // Limit to max 2 categories for speed
          items: {
            type: "object",
            properties: {
              category_id: { type: "string" },
              confidence: { type: "number", minimum: 0.6, maximum: 1 }
            },
            required: ["category_id", "confidence"]
          }
        }
      },
      required: ["categories"]
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
      temperature: 0,      // 0 for fastest, most consistent results
      max_tokens: 80       // Reduced from 150 - we only need category IDs + confidence
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('No response content');

    const parsed = JSON.parse(content) as ClassificationResult;
    
    // Validate response
    if (!Array.isArray(parsed.categories)) {
      throw new Error('Invalid categories array');
    }
    
    // Quick validation - schema already ensures confidence >= 0.6
    for (const category of parsed.categories) {
      if (!category.category_id || typeof category.confidence !== 'number') {
        throw new Error('Invalid category data');
      }
    }
    
    // Already filtered by schema (min confidence 0.6), just sort by confidence
    const validCategories = parsed.categories.sort((a, b) => b.confidence - a.confidence);
    
    return {
      categories: validCategories
    };
  } catch (error) {
    console.error('Classification error:', error);
    return { categories: [] };
  }
}

// Summary Agent - Internal version
export async function summarizeEmail(emailBody: string): Promise<SummaryResult | null> {
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