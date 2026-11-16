const isRegionalIndicator = character => {
  const codePoint = character.codePointAt(0);
  return codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
};

const isExtend = character => {
  const codePoint = character.codePointAt(0);
  return /\p{Mark}/u.test(character)
    || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
    || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
    || (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff)
    || (codePoint >= 0xe0020 && codePoint <= 0xe007f);
};

const splitFallbackGraphemes = value => {
  const clusters = [];
  for (const character of Array.from(String(value || ''))) {
    const previous = clusters[clusters.length - 1] || '';
    const previousRegionalCount = Array.from(previous).filter(isRegionalIndicator).length;
    if (!previous) {
      clusters.push(character);
    } else if (character === '\u200d' || previous.endsWith('\u200d') || isExtend(character)
      || (isRegionalIndicator(character) && previousRegionalCount === 1)) {
      clusters[clusters.length - 1] += character;
    } else {
      clusters.push(character);
    }
  }
  return clusters;
};

export const splitGraphemes = value => {
  const text = String(value || '');
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => item.segment);
  }
  return splitFallbackGraphemes(text);
};

const containsEmoji = grapheme => /\p{Extended_Pictographic}/u.test(grapheme)
  || /\p{Regional_Indicator}{2}/u.test(grapheme)
  || /[#*0-9]\ufe0f?\u20e3/u.test(grapheme);

export const extractFirstEmojiGrapheme = value => splitGraphemes(value).find(containsEmoji) || '';
