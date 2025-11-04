// Smart AI (unchanged logic)
async function askSmartAI() {
    const promptInput = document.getElementById("smartPrompt");
    const responseDiv = document.getElementById("smartResponse");
    const modeSpan = document.getElementById("smartMode");
  
    const prompt = promptInput.value.trim();
    if (!prompt) return;
  
    // ✅ Track TOTAL time from query start
    const queryStartTime = Date.now();
  
    // Show initial loading
    responseDiv.innerHTML = `
      <div class="text-center text-muted">
        <i class="fas fa-spinner fa-spin"></i> Analyzing query...
      </div>
    `;
  
    try {
      const response = await fetch(`${API_URL}/api/chat-smart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
  
      // Both modes now stream!
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullAnswer = '';
      let metadata = null;
      let mode = null;
      const llmStartTime = Date.now();  // ✅ Track LLM generation time
      let tokenCount = 0;
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
  
        for (const line of lines) {
          if (!line.trim()) continue;
  
          try {
            const data = JSON.parse(line);
  
            // Mode indicator
            if (data.mode) {
              mode = data.mode;
              
              if (mode === 'rag') {
                modeSpan.textContent = "🌍 Web Search Mode";
                // Initialize RAG streaming display
                responseDiv.innerHTML = `
                  <div class="status-progress">
                    <div class="status-step active" id="smart-step-searching">
                      <i class="fas fa-spinner fa-spin me-2"></i> Searching...
                    </div>
                    <div class="status-step" id="smart-step-generating">
                      <i class="far fa-circle me-2"></i> Generating answer...
                    </div>
                  </div>
                  <div id="smartStreamContent"></div>
                `;
              } else if (mode === 'local') {
                modeSpan.textContent = "🤖 Local AI";
                // Initialize local LLM streaming display
                responseDiv.innerHTML = `
                  <div class="alert alert-light" id="smartStreamingResponse">
                    <strong><i class="fas fa-comment-dots"></i> AI:</strong><br><br>
                    <span id="smartAnswerText"><span class="blinking-cursor">▊</span></span>
                  </div>
                `;
              }
              continue;
            }
  
            // RAG-specific handling
            if (mode === 'rag') {
              // Status updates
              if (data.status) {
                if (data.status === 'searching' || data.status === 'scraping' || data.status === 'embedding') {
                  const el = document.getElementById('smart-step-searching');
                  if (el) {
                    el.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>${data.message || 'Processing...'}`;
                  }
                } else if (data.status === 'generating') {
                  markStepComplete('smart-step-searching');
                  const el = document.getElementById('smart-step-generating');
                  if (el) {
                    el.className = 'status-step active';
                    el.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating answer...';
                  }
                }
              }
  
              // Metadata
              if (data.metadata) {
                metadata = data.metadata;
                markStepComplete('smart-step-searching');
              }
  
              // Streaming chunks
              if (data.chunk) {
                if (fullAnswer === '') {
                  const streamContent = document.getElementById('smartStreamContent');
                  if (streamContent) {
                    streamContent.innerHTML = `
                      <div class="alert alert-light mt-3">
                        <h5><i class="fas fa-lightbulb"></i> Answer:</h5>
                        <p id="smartAnswerText"><span class="blinking-cursor">▊</span></p>
                      </div>
                    `;
                  }
                }
                fullAnswer += data.chunk;
                const answerEl = document.getElementById('smartAnswerText');
                if (answerEl) {
                  answerEl.innerHTML = escapeHtml(fullAnswer) + '<span class="blinking-cursor">▊</span>';
                }
              }
  
              // Completion
              if (data.done || data.timing) {
                const cursor = document.querySelector('.blinking-cursor');
                if (cursor) cursor.remove();
  
                const totalElapsedTime = ((Date.now() - queryStartTime) / 1000).toFixed(2);
  
                let html = `
                  <div class="alert alert-success mb-3">
                    <i class="fas fa-check-circle"></i> Search completed in ${totalElapsedTime}s
                  </div>
                  
                  <div class="alert alert-light">
                    <h5><i class="fas fa-lightbulb"></i> Answer:</h5>
                    <p>${escapeHtml(fullAnswer)}</p>
                  </div>
                `;
  
                // Add sources if available
                if (metadata && metadata.sources) {
                  html += '<h6 class="mt-3"><i class="fas fa-book"></i> Sources:</h6>';
                  metadata.sources.forEach(source => {
                    html += `
                      <div class="rag-source">
                        <div class="rag-source-title">
                          <i class="fas fa-link"></i> ${escapeHtml(source.title || 'Source')}
                        </div>
                        <a href="${escapeHtml(source.url)}" target="_blank" class="rag-source-url">
                          ${escapeHtml(source.url)}
                        </a>
                      </div>
                    `;
                  });
                }
  
                // Add timing details if available
                if (data.timing || metadata) {
                  html += `
                    <div class="stats-box mt-3">
                      <strong><i class="fas fa-clock"></i> Timing Breakdown:</strong><br>
                      <div class="row mt-2">
                        <div class="col-6"><strong>Total Time:</strong> ${totalElapsedTime}s</div>
                  `;
                  
                  if (metadata && metadata.timing) {
                    html += `
                        <div class="col-6">Search: ${(metadata.timing.searchElapsed / 1000).toFixed(2)}s</div>
                        <div class="col-6">Scraping: ${(metadata.timing.scrapeElapsed / 1000).toFixed(2)}s</div>
                        <div class="col-6">Embedding: ${(metadata.timing.embedElapsed / 1000).toFixed(2)}s</div>
                    `;
                  }
                  
                  html += `
                      </div>
                      <small class="text-muted d-block mt-2">
                        <i class="fas fa-info-circle"></i> Total time from query to final response
                      </small>
                    </div>
                  `;
                }
  
                responseDiv.innerHTML = html;
              }
            }
            
            // Local LLM streaming handling
            else if (mode === 'local' && data.response) {
              fullAnswer += data.response;
              tokenCount++;  // ✅ Count tokens
              const answerEl = document.getElementById('smartAnswerText');
              if (answerEl) {
                answerEl.innerHTML = escapeHtml(fullAnswer) + '<span class="blinking-cursor">▊</span>';
              }
            }
            
            // ✅ Handle local LLM completion
            if (mode === 'local' && data.done) {
              const totalElapsedTime = ((Date.now() - queryStartTime) / 1000).toFixed(2);
              const llmGenerationTime = ((Date.now() - llmStartTime) / 1000).toFixed(2);
              const tokensPerSec = (tokenCount / Math.max(llmGenerationTime, 0.01)).toFixed(1);
  
              // Remove cursor
              const cursor = document.querySelector('.blinking-cursor');
              if (cursor) cursor.remove();
              
              // Add stats box with both times
              const streamingResponse = document.getElementById('smartStreamingResponse');
              if (streamingResponse) {
                streamingResponse.innerHTML += `
                  <div class="stats-box mt-3">
                    <strong><i class="fas fa-clock"></i> Performance Stats:</strong><br>
                    <div class="row mt-2">
                      <div class="col-6"><strong>Total Time:</strong> ${totalElapsedTime}s</div>
                      <div class="col-6">LLM Time: ${llmGenerationTime}s</div>
                      <div class="col-6">Speed: ${tokensPerSec} tok/s</div>
                      <div class="col-6">Output: ${data.eval_count || tokenCount} tokens</div>
                    </div>
                    <small class="text-muted d-block mt-2">
                      <i class="fas fa-info-circle"></i> Total time includes classification + generation
                    </small>
                  </div>
                `;
              }
            }
  
            // Errors
            if (data.error) {
              responseDiv.innerHTML = `
                <div class="alert alert-danger">
                  <i class="fas fa-exclamation-triangle"></i> ${data.error}
                </div>
              `;
            }
  
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
  
    } catch (err) {
      console.error(err);
      modeSpan.textContent = "❌ Error";
      responseDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-circle"></i> Error: ${err.message}
        </div>
      `;
    }
  
    promptInput.value = "";
    promptInput.focus();
  }