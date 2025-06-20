/**
 * Detects the text direction (RTL or LTR) based on the content
 * @param text - The text to analyze
 * @returns 'rtl' for right-to-left languages, 'ltr' for left-to-right languages
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' {
  if (!text || typeof text !== 'string') {
    return 'ltr'; // Default to LTR for empty or invalid text
  }

  // RTL Unicode ranges
  const rtlRanges = [
    // Arabic (U+0600-U+06FF)
    /[\u0600-\u06FF]/,
    // Hebrew (U+0590-U+05FF)
    /[\u0590-\u05FF]/,
    // Arabic Supplement (U+0750-U+077F)
    /[\u0750-\u077F]/,
    // Arabic Extended-A (U+08A0-U+08FF)
    /[\u08A0-\u08FF]/,
    // Arabic Extended-B (U+0870-U+089F)
    /[\u0870-\u089F]/,
    // Arabic Presentation Forms-A (U+FB50-U+FDFF)
    /[\uFB50-\uFDFF]/,
    // Arabic Presentation Forms-B (U+FE70-U+FEFF)
    /[\uFE70-\uFEFF]/,
    // Hebrew Presentation Forms (U+FB1D-U+FB4F)
    /[\uFB1D-\uFB4F]/,
    // Syriac (U+0700-U+074F)
    /[\u0700-\u074F]/,
    // Thaana (U+0780-U+07BF)
    /[\u0780-\u07BF]/,
    // N'Ko (U+07C0-U+07FF)
    /[\u07C0-\u07FF]/,
    // Samaritan (U+0800-U+083F)
    /[\u0800-\u083F]/,
    // Mandaic (U+0840-U+085F)
    /[\u0840-\u085F]/,
    // Arabic Mathematical Alphabetic Symbols (U+1EE00-U+1EEFF)
    /[\u1EE00-\u1EEFF]/
  ];

  // Count RTL and LTR characters
  let rtlCount = 0;
  let ltrCount = 0;
  
  // Remove whitespace and punctuation for more accurate detection
  const cleanText = text.replace(/[\s\p{P}\p{S}\p{N}]/gu, '');
  
  for (const char of cleanText) {
    // Check if character is RTL
    if (rtlRanges.some(range => range.test(char))) {
      rtlCount++;
    } else if (/[\p{L}]/u.test(char)) {
      // Count as LTR if it's a letter but not RTL
      ltrCount++;
    }
  }

  // If we have RTL characters and they make up more than 30% of the text, consider it RTL
  const totalLetters = rtlCount + ltrCount;
  if (totalLetters === 0) {
    return 'ltr'; // Default to LTR if no letters found
  }

  const rtlPercentage = rtlCount / totalLetters;
  return rtlPercentage > 0.3 ? 'rtl' : 'ltr';
}

/**
 * Detects if text contains any RTL characters
 * @param text - The text to check
 * @returns true if text contains RTL characters
 */
export function hasRTLCharacters(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const rtlPattern = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u0800-\u083F\u0840-\u085F\u08A0-\u08FF\u0870-\u089F\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF\u1EE00-\u1EEFF]/;
  return rtlPattern.test(text);
}