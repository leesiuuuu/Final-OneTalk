import assert from 'node:assert/strict';
import { compareWord, evaluateAnswer, splitWords, updateCombo } from './scoring.mjs';

assert.deepEqual(splitWords(' 저는  문제를 해결합니다 '), ['저는', '문제를', '해결합니다']);
assert.deepEqual(compareWord('문재를', '문제를'), { correct: 2, total: 3 });
assert.deepEqual(compareWord('지원자입니다요', '지원자입니다'), { correct: 6, total: 6 });
assert.deepEqual(compareWord('지원자', '지원자입니다'), { correct: 3, total: 6 });

const combo = updateCombo('문재를', '문제를', 2);
assert.equal(combo.combo, 1);
assert.equal(combo.maximum, 3);

const perfect = evaluateAnswer(['저는', '지원자입니다'], '저는 지원자입니다', 10, 5, 10);
assert.equal(perfect.accuracy, 1);
assert.equal(perfect.base, 80);
assert.equal(perfect.perfect, 15);
assert.equal(perfect.combo, 5);
assert.equal(perfect.speed, 5);
assert.equal(perfect.totalScore, 105);

const timeout = evaluateAnswer(['저는'], '저는 지원자입니다', 2, 0, 10);
assert.equal(timeout.speed, 0);
assert.ok(timeout.accuracy > 0 && timeout.accuracy < 1);

console.log('scoring tests passed');
