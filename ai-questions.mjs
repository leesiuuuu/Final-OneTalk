const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

function extractJson(text) {
  const source = String(text ?? '').replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  const start = source.indexOf('[');
  const end = source.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('AI 응답에서 질문 목록을 찾지 못했습니다.');
  return JSON.parse(source.slice(start, end + 1));
}

function normalizePair(item, maxWords) {
  const question = String(item?.question ?? '').replace(/[<>]/g, '').trim().slice(0, 100);
  const answer = String(item?.answer ?? '').replace(/[<>]/g, '').trim().split(/\s+/u).slice(0, maxWords).join(' ');
  const minimumWords = maxWords <= 5 ? 4 : 5;
  if (!question || answer.split(/\s+/u).length < minimumWords) throw new Error('AI가 생성한 문장이 너무 짧습니다.');
  return [question, answer];
}

export function parseInterviewQuestions(text, roundCount, maxWords) {
  const items = extractJson(text);
  if (!Array.isArray(items) || items.length < roundCount) throw new Error('AI 질문 수가 부족합니다.');
  return items.slice(0, roundCount).map(item => normalizePair(item, maxWords));
}

export function aiQuestionsAvailable() {
  return Boolean(process.env.GROQ_API_KEY);
}

export async function generateInterviewQuestions({ roundCount, maxWords, difficulty }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY가 설정되지 않았습니다.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28000);
  const wordRule = maxWords <= 5 ? '각 답변은 반드시 자연스러운 4~5어절' : `각 답변은 자연스러운 5~${maxWords}어절`;
  const prompt = `한국어 취업 면접 타자 게임용 질문과 모범 답변을 ${roundCount}개 생성해 주세요.
난이도: ${difficulty}. ${wordRule}인 완결된 한 문장이어야 합니다. ${maxWords}어절을 절대 넘기지 마세요.
JSON 배열만 반환하세요: [{"question":"...","answer":"..."}]`;
  try {
    let parseError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL, temperature: attempt === 0 ? 0.75 : 0.45, max_tokens: 1800,
          messages: [{ role: 'user', content: `${prompt}${attempt ? '\n이전 응답은 개수 또는 어절 조건이 맞지 않았습니다. 모든 조건을 다시 확인하세요.' : ''}` }],
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`AI API 오류 (${response.status})`);
      const payload = await response.json();
      try {
        return parseInterviewQuestions(payload?.choices?.[0]?.message?.content, roundCount, maxWords);
      } catch (error) {
        parseError = error;
      }
    }
    throw parseError;
  } finally {
    clearTimeout(timeout);
  }
}
