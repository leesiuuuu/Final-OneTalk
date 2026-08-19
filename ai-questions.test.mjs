import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInterviewQuestions } from './ai-questions.mjs';

test('Groq JSON 응답을 라운드 수와 최대 어절 규칙에 맞게 정리한다', () => {
  const response = `\`\`\`json
  [
    {"question":"지원 동기는 무엇인가요?","answer":"빠르게 배우며 고객에게 새로운 가치를 꾸준히 전달하고 싶습니다"},
    {"question":"본인의 강점은 무엇인가요?","answer":"복잡한 문제를 차분하게 나누고 끝까지 해결하는 실행력이 있습니다"},
    {"question":"마지막 한마디를 해주세요.","answer":"오늘의 기회를 내일의 분명한 성과로 반드시 증명하겠습니다"}
  ]
  \`\`\``;
  const questions = parseInterviewQuestions(response, 3, 6);
  assert.equal(questions.length, 3);
  assert.equal(questions[0][0], '지원 동기는 무엇인가요?');
  assert.equal(questions[0][1].split(/\s+/u).length, 6);
});

test('Groq 응답의 질문 수가 부족하면 기본 문장 폴백을 위해 오류를 낸다', () => {
  assert.throws(
    () => parseInterviewQuestions('[{"question":"질문","answer":"충분히 자연스러운 다섯 어절 답변 문장입니다"}]', 3, 8),
    /질문 수가 부족합니다/,
  );
});

test('최대 5어절에서는 자연스러운 4~5어절 답변을 허용한다', () => {
  const response = `[
    {"question":"강점은 무엇인가요?","answer":"문제를 끝까지 책임지고 해결합니다"},
    {"question":"지원 동기는 무엇인가요?","answer":"고객과 함께 성장하고 싶습니다"},
    {"question":"마지막 한마디는?","answer":"결과로 제 가능성을 증명하겠습니다"}
  ]`;
  const questions = parseInterviewQuestions(response, 3, 5);
  assert.equal(questions.length, 3);
  assert.ok(questions.every(([, answer]) => answer.split(/\s+/u).length <= 5));
});
