const API_URL = 'https://vacation-hugh-underground-zinc.trycloudflare.com';
const WS_URL  = 'wss://vacation-hugh-underground-zinc.trycloudflare.com';

function setRAGExample(question) {
  document.getElementById('ragPrompt').value = question;
  document.getElementById('ragPrompt').focus();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function markStepComplete(stepId) {
  const el = document.getElementById(stepId);
  if (el) {
    el.className = 'status-step complete';
    el.querySelector('i').className = 'fas fa-check-circle me-2';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('ragPrompt').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !document.getElementById('ragBtn').disabled) {
      searchRAG();
    }
  });

  document.getElementById('prompt').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !document.getElementById('sendBtn').disabled) {
      askAI();
    }
  });

  document.getElementById('smartPrompt').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      askSmartAI();
    }
  });

  document.getElementById('pdfPrompt').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !document.getElementById('pdfBtn').disabled) {
      askPDF();
    }
  });
});
