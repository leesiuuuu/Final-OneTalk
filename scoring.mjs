export function splitWords(sentence) {
  return sentence.trim().split(/\s+/u).filter(Boolean);
}

export function compareWord(input = '', target = '') {
  const typed = Array.from(input.normalize('NFC'));
  const expected = Array.from(target.normalize('NFC'));
  let correct = 0;
  for (let i = 0; i < expected.length; i += 1) {
    if (typed[i] === expected[i]) correct += 1;
  }
  return { correct, total: expected.length };
}

export function evaluateAnswer(inputWords, targetSentence, maxCombo, remaining, duration, modifiers = {}) {
  const targets = splitWords(targetSentence);
  let correct = 0;
  let total = 0;

  targets.forEach((target, index) => {
    const result = compareWord(inputWords[index] ?? '', target);
    correct += result.correct;
    total += result.total;
  });

  const accuracy = total ? correct / total : 0;
  const mistakePenaltyMultiplier = Math.max(1, Number(modifiers.mistakePenaltyMultiplier) || 1);
  const scoreMultiplier = Math.max(1, Number(modifiers.scoreMultiplier) || 1);
  const base = Math.max(0, 80 - (1 - accuracy) * 80 * mistakePenaltyMultiplier) * scoreMultiplier;
  const perfect = (accuracy === 1 ? 15 : 0) * scoreMultiplier;
  const combo = Math.min(maxCombo * 0.5, 5) * scoreMultiplier;
  const speed = (duration > 0 ? Math.max(0, remaining) / duration * accuracy * 10 : 0) * scoreMultiplier;
  const totalScore = base + perfect + combo + speed;

  return { accuracy, correct, total, base, perfect, combo, speed, totalScore, mistakePenaltyMultiplier, scoreMultiplier };
}

export function updateCombo(input, target, currentCombo) {
  let combo = currentCombo;
  let maximum = currentCombo;
  const typed = Array.from(input.normalize('NFC'));
  const expected = Array.from(target.normalize('NFC'));
  const length = Math.max(typed.length, expected.length);

  for (let i = 0; i < length; i += 1) {
    if (i < expected.length && typed[i] === expected[i]) {
      combo += 1;
      maximum = Math.max(maximum, combo);
    } else {
      combo = 0;
    }
  }
  return { combo, maximum };
}
