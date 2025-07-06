let questions = [];

fetch('/questions')
  .then(res => res.json())
  .then(data => {
    questions = data;
    showQuestions();
  });

function showQuestions() {
  const area = document.getElementById('examArea');
  area.innerHTML = "";
  questions.forEach((q, index) => {
    const div = document.createElement('div');
    div.className = "question";
    div.innerHTML = `<p>${index + 1}. ${q.question}</p>` +
      q.options.map((opt, i) =>
        `<label><input type="radio" name="q${index}" value="${opt}"> ${opt}</label><br>`
      ).join('');
    area.appendChild(div);
  });
}

function submitExam() {
  const answers = questions.map((q, index) => {
    const selected = document.querySelector(`input[name="q${index}"]:checked`);
    return selected ? selected.value : "";
  });

  fetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers })
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById('result').innerText = `You scored ${data.score}/${questions.length}`;
  });
}
