/**
 * Fix double-encoded UTF-8 text that appears garbled
 * This handles cases where UTF-8 text was incorrectly interpreted as Latin-1/Windows-1252
 * and then re-encoded as UTF-8
 */

export function fixDoubleEncodedUTF8(text: string): string {
  // Common patterns that indicate double-encoding
  const doubleEncodedPatterns = [
    /Ã¡|Ã |Ã¢|Ã£|Ã¤/g,  // á variants
    /Ã©|Ã¨|Ãª|Ã«/g,     // é variants  
    /Ã­|Ã¬|Ã®|Ã¯/g,     // í variants
    /Ã³|Ã²|Ã´|Ãµ|Ã¶/g,  // ó variants
    /Ãº|Ã¹|Ã»|Ã¼/g,     // ú variants
    /Ã§/g,              // ç
    /Ã±/g,              // ñ
    /áº|áº¡|áº£|áº¥|áº§|áº©|áº«|áº­|áº¯|áº±|áº³|áºµ|áº·/g, // Vietnamese specific
    /Ä|Æ¡|Æ°/g,         // Vietnamese specific characters
  ];

  // Check if text appears to be double-encoded
  const hasDoubleEncoding = doubleEncodedPatterns.some(pattern => pattern.test(text));
  
  if (!hasDoubleEncoding) {
    return text;
  }

  try {
    // Try to fix by converting from mis-interpreted Latin-1 back to UTF-8
    const buffer = Buffer.from(text, 'latin1');
    const fixed = buffer.toString('utf8');
    
    // Verify the fix worked by checking for common Vietnamese characters
    const hasVietnamese = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/g.test(fixed);
    
    // If we successfully found Vietnamese characters, return the fixed text
    if (hasVietnamese || !fixed.includes('�')) {
      return fixed;
    }
    
    // If that didn't work, try another approach - manual replacement
    return manualFixEncoding(text);
  } catch (e) {
    console.warn('Failed to fix double-encoded text:', e);
    return manualFixEncoding(text);
  }
}

function manualFixEncoding(text: string): string {
  // Manual replacement map for common double-encoded Vietnamese characters
  const replacements: { [key: string]: string } = {
    'Ã¡': 'á', 'Ã ': 'à', 'áº£': 'ả', 'Ã£': 'ã', 'áº¡': 'ạ',
    'Ä': 'ă', 'áº±': 'ằ', 'áº¯': 'ắ', 'áº³': 'ẳ', 'áºµ': 'ẵ', 'áº·': 'ặ',
    'Ã¢': 'â', 'áº§': 'ầ', 'áº¥': 'ấ', 'áº©': 'ẩ', 'áº«': 'ẫ', 'áº­': 'ậ',
    'Ã©': 'é', 'Ã¨': 'è', 'áº»': 'ẻ', 'áº½': 'ẽ', 'áº¹': 'ẹ',
    'Ãª': 'ê', 'á»': 'ề', 'áº¿': 'ế', 'á»': 'ể', 'á»': 'ễ', 'á»': 'ệ',
    'Ã­': 'í', 'Ã¬': 'ì', 'á»': 'ỉ', 'Ä©': 'ĩ', 'á»': 'ị',
    'Ã³': 'ó', 'Ã²': 'ò', 'á»': 'ỏ', 'Ãµ': 'õ', 'á»': 'ọ',
    'Ã´': 'ô', 'á»': 'ồ', 'á»': 'ố', 'á»': 'ổ', 'á»': 'ỗ', 'á»': 'ộ',
    'Æ¡': 'ơ', 'á»': 'ờ', 'á»': 'ớ', 'á»': 'ở', 'á»¡': 'ỡ', 'á»£': 'ợ',
    'Ãº': 'ú', 'Ã¹': 'ù', 'á»§': 'ủ', 'Å©': 'ũ', 'á»¥': 'ụ',
    'Æ°': 'ư', 'á»«': 'ừ', 'á»©': 'ứ', 'á»­': 'ử', 'á»¯': 'ữ', 'á»±': 'ự',
    'Ã½': 'ý', 'á»³': 'ỳ', 'á»·': 'ỷ', 'á»¹': 'ỹ', 'á»µ': 'ỵ',
    'Ä': 'đ', 'Ä': 'Đ',
    'â': '"', 'â': '"', 'â': '–', 'â': '—',
  };

  let fixed = text;
  for (const [wrong, correct] of Object.entries(replacements)) {
    fixed = fixed.replace(new RegExp(wrong, 'g'), correct);
  }
  
  return fixed;
}

/**
 * Process email content to fix encoding issues
 */
export function processEmailContent(content: string): string {
  if (!content) return content;
  
  // First, try to fix double-encoded UTF-8
  let processed = fixDoubleEncodedUTF8(content);
  
  // Clean up any remaining artifacts
  processed = processed
    .replace(/â€™/g, "'")  // Smart quote
    .replace(/â€œ/g, '"')  // Left double quote
    .replace(/â€/g, '"')   // Right double quote
    .replace(/â€"/g, '—')  // Em dash
    .replace(/â€"/g, '–')  // En dash
    .replace(/Â /g, ' ')   // Non-breaking space artifact
    .replace(/Â/g, '')     // Stray Â characters
    .replace(/Ã‚/g, '')    // Another artifact
    .trim();
  
  return processed;
}