// Normal LLM askAI() (unchanged logic)
async function askAI() {
    const promptInput = document.getElementById('prompt');
    const responseDiv = document.getElementById('response');
    const button      = document.getElementById('sendBtn');
    const modelSelect = document.getElementById('modelSelect');
  
    const prompt = promptInput.value.trim();
    if (!prompt) return;
  
    const selectedModel   = modelSelect.value;
    const isReasoningModel = selectedModel.includes('JOSIEFIED-Qwen3');
  
    button.disabled = true;
    responseDiv.innerHTML = isReasoningModel
      ? `<div class="alert alert-warning text-center">
           <i class="fas fa-brain"></i> Gathering thoughts...
           <div class="small text-muted mt-2">This model will show its reasoning before the final answer.</div>
         </div>`
      : `<div class="text-center">
           <div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>
           <p class="mt-2 text-muted">Thinking...</p>
         </div>`;
  
    // Inject thinking directive ONLY for the reasoning model
    let promptToSend = prompt;
    if (isReasoningModel) {
      promptToSend = `/think
  Before giving your final answer, write your reasoning inside <think>...</think> tags.
  Then after </think>, provide the final answer clearly and concisely.
  ${prompt}`;
    }
  
    let fullResponse = '';
    let startTime = Date.now();
    let tokenCount = 0;
  
    try {
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          prompt: promptToSend,
          stream: true,
          options: {
            num_predict: 1000,
            temperature: 0.7,
            top_p: 0.9,
            repeat_penalty: 1.1
          }
        })
      });
  
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
  
      const modelName = modelSelect.options[modelSelect.selectedIndex].text;
  
      responseDiv.innerHTML = `
        <div class="alert alert-light mb-0" id="streamingResponse">
          <strong><i class="fas fa-comment-dots"></i> ${modelName}:</strong><br><br>
          <span id="responseText"></span><span class="blinking-cursor">▊</span>
        </div>
      `;
  
      const responseText = document.getElementById('responseText');
  
      // Format response with code blocks and visible reasoning
      function formatResponse(text) {
        // Reasoning block: <think> ... </think>
        text = text.replace(/<think>([\s\S]*?)<\/think>/gi, function(_match, reasoning) {
          const safe = reasoning.trim();
          return `
            <div style="background:linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);padding:12px;border-left:4px solid #ffc107;border-radius:6px;margin:8px 0;">
              <strong style="color:#856404;">🧠 Reasoning:</strong><br>
              <em style="color:#856404;">${safe}</em>
            </div>
          `;
        });
  
        // Markdown code fences
        text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, function(_m, lang, code) {
          const language = lang || 'code';
          return `<div class="code-header">${language}</div><pre><code>${code.replace(/</g,'&lt;').replace(/>/g,'&gt;').trim()}</code></pre>`;
        });
  
        // Inline code
        text = text.replace(/`([^`]+)`/g, function(_m, c) {
          return `<code>${c.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</code>`;
        });
  
        // Bold
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
        // Line breaks
        text = text.replace(/\n/g, '<br>');
  
        return text;
      }
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
  
        for (const line of lines) {
          if (line.trim() === '') continue;
  
          try {
            const data = JSON.parse(line);
  
            if (data.response) {
              fullResponse += data.response;
              responseText.innerHTML = formatResponse(fullResponse);
              tokenCount++;
            }
  
            if (data.done) {
              const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
              const tokensPerSec = (tokenCount / Math.max(totalSeconds, 0.01)).toFixed(1);
  
              const cursor = document.querySelector('.blinking-cursor');
              if (cursor) cursor.remove();
  
              responseDiv.innerHTML += `
                <div class="stats-box">
                  <strong><i class="fas fa-clock"></i> Performance Stats:</strong><br>
                  <div class="row mt-2">
                    <div class="col-6">Duration: ${totalSeconds}s</div>
                    <div class="col-6">Speed: ${tokensPerSec} tok/s</div>
                    <div class="col-6">Input: ${data.prompt_eval_count || 0} tokens</div>
                    <div class="col-6">Output: ${data.eval_count || tokenCount} tokens</div>
                  </div>
                </div>
              `;
            }
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
  
      promptInput.value = '';
      promptInput.focus();
  
    } catch (error) {
      responseDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle"></i> Error: ${error.message}<br>
          <small class="text-muted">Make sure the model is installed: <code>ollama pull ${selectedModel}</code></small>
        </div>`;
    } finally {
      button.disabled = false;
    }
  }