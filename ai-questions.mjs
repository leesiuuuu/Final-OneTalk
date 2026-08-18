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
  if (!question || answer.split(/\s+/u).length < Math.min(5, maxWords)) throw new Error('AI가 생성한 문장이 너무 짧습니다.');
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
  const timeout = setTimeout(() => controller.abort(), 18000);
  const prompt = `한국어 취업 면접 타자 게임용 질문과 모범 답변을 ${roundCount}개 생성해 주세요.
난이도: ${difficulty}. 각 답변은 자연스러운 한 문장이고 최대 ${maxWords}어절이어야 합니다.
JSON 배열만 반환하세요: [{"question":"...","answer":"..."}]`;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL, temperature: 0.75, max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI API 오류 (${response.status})`);
    const payload = await response.json();
    return parseInterviewQuestions(payload?.choices?.[0]?.message?.content, roundCount, maxWords);
  } finally {
    clearTimeout(timeout);
  }
}
