// RAG Web Search (unchanged logic)
function updateRAGStatus(status, message) {
    const statusMap = {
      'searching': 'step-searching',
      'scraping': 'step-scraping',
      'embedding': 'step-embedding',
      'generating': 'step-generating'
    };
  
    const stepId = statusMap[status];
    if (stepId) {
      // Mark previous steps as complete
      Object.keys(statusMap).forEach(key => {
        const id = statusMap[key];
        const el = document.getElementById(id);
        if (el && id !== stepId) {
          markStepComplete(id);
        }
      });
  
      // Activate current step
      const currentEl = document.getElementById(stepId);
      if (currentEl) {
        currentEl.className = 'status-step active';
        currentEl.querySelector('i').className = 'fas fa-spinner fa-spin me-2';
        const text = currentEl.textContent.trim().split('\n')[0];
        currentEl.textContent = '';
        currentEl.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i>${message || text}`;
      }
    }
  }
  
  async function searchRAG() {
    const promptInput = document.getElementById('ragPrompt');
    const responseDiv = document.getElementById('ragResponse');
    const button = document.getElementById('ragBtn');
  
    const question = promptInput.value.trim();
    if (!question) {
      responseDiv.innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-circle"></i> Please enter a question
        </div>`;
      return;
    }
  
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
  
    // Initialize status display
    responseDiv.innerHTML = `
      <div class="status-progress">
        <div class="status-step active" id="step-searching">
          <i class="fas fa-spinner fa-spin me-2"></i> Searching the web...
        </div>
        <div class="status-step" id="step-scraping">
          <i class="far fa-circle me-2"></i> Scraping content...
        </div>
        <div class="status-step" id="step-embedding">
          <i class="far fa-circle me-2"></i> Analyzing content...
        </div>
        <div class="status-step" id="step-generating">
          <i class="far fa-circle me-2"></i> Generating answer...
        </div>
      </div>
      <div id="ragStreamContent"></div>
    `;
  
    const streamContent = document.getElementById('ragStreamContent');
    const startTime = Date.now();
    let fullAnswer = '';
    let metadata = null;
    let sources = [];
  
    try {
      const response = await fetch(`${API_URL}/api/rag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
  
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
  
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
  
        for (const line of lines) {
          if (!line.trim()) continue;
  
          try {
            const data = JSON.parse(line);
  
            // Handle status updates
            if (data.status) {
              updateRAGStatus(data.status, data.message);
            }
  
            // Handle metadata (sources and context info)
            if (data.metadata) {
              metadata = data.metadata;
              sources = data.metadata.sources || [];
              markStepComplete('step-embedding');
            }
  
            // Handle streaming answer chunks
            if (data.chunk) {
              if (fullAnswer === '') {
                // First chunk - initialize answer display
                markStepComplete('step-generating');
                streamContent.innerHTML = `
                  <div class="rag-answer mt-3">
                    <h5><i class="fas fa-lightbulb"></i> Answer:</h5>
                    <p id="ragAnswerText"><span class="blinking-cursor">▊</span></p>
                  </div>
                `;
              }
              fullAnswer += data.chunk;
              const answerEl = document.getElementById('ragAnswerText');
              if (answerEl) {
                answerEl.innerHTML = escapeHtml(fullAnswer) + '<span class="blinking-cursor">▊</span>';
              }
            }
  
            // Handle completion
            if (data.done || data.timing) {
              const cursor = document.querySelector('.blinking-cursor');
              if (cursor) cursor.remove();
  
              const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
              // Build final HTML
              let html = `
                <div class="alert alert-success mb-3">
                  <i class="fas fa-check-circle"></i> Search completed in ${duration}s
                </div>
                
                <div class="rag-answer">
                  <h5><i class="fas fa-lightbulb"></i> Answer:</h5>
                  <p>${escapeHtml(fullAnswer)}</p>
                </div>
              `;
  
              // Add sources
              if (sources && sources.length > 0) {
                html += '<h6 class="mt-4"><i class="fas fa-book"></i> Sources:</h6>';
                sources.forEach(source => {
                  html += `
                    <div class="rag-source">
                      <div class="rag-source-title">
                        <i class="fas fa-link"></i> ${escapeHtml(source.title)}
                      </div>
                      <a href="${escapeHtml(source.url)}" target="_blank" class="rag-source-url">
                        ${escapeHtml(source.url)}
                      </a>
                      <div class="text-muted small mt-1">
                        <i class="far fa-calendar"></i> ${escapeHtml(source.date)}
                      </div>
                    </div>
                  `;
                });
              }
  
              // Add metadata
              if (metadata) {
                html += `
                  <div class="rag-metadata">
                    <strong><i class="fas fa-info-circle"></i> Search Details:</strong>
                    <div class="row mt-2">
                      <div class="col-md-3">
                        <i class="fas fa-file-alt"></i> Chunks: ${metadata.chunksUsed}/${metadata.totalChunks}
                      </div>
                      <div class="col-md-3">
                        <i class="fas fa-chart-line"></i> Best match: ${metadata.topSimilarity}
                      </div>
                      <div class="col-md-3">
                        <i class="fas fa-text-height"></i> Context: ${metadata.contextLength} chars
                      </div>
                      <div class="col-md-3">
                        <i class="fas fa-clock"></i> Time: ${duration}s
                      </div>
                `;
                
                if (metadata.queryWasRefined && metadata.searchAttempts > 1) {
                  html += `
                      <div class="col-12 mt-2">
                        <div class="alert alert-theme-info mb-0">
                          <i class="fas fa-magic"></i> <strong>Query Refinement:</strong> 
                          No results found for original query. Successfully refined after ${metadata.searchAttempts} attempt(s).<br>
                          <small class="text-muted">
                            Original: "${escapeHtml(metadata.originalQuery)}" → 
                            Refined: "${escapeHtml(metadata.finalQuery)}"
                          </small>
                        </div>
                      </div>
                  `;
                }
                
                html += `
                    </div>
                  </div>
                `;
              }
  
              responseDiv.innerHTML = html;
            }
  
            // Handle errors
            if (data.error) {
              responseDiv.innerHTML = `
                <div class="alert alert-danger">
                  <h5><i class="fas fa-exclamation-triangle"></i> Error</h5>
                  <p>${data.error}</p>
                  ${data.details ? `<small class="text-muted">${data.details}</small>` : ''}
                </div>`;
            }
  
          } catch (e) {
            console.error('Parse error:', e, 'Line:', line);
          }
        }
      }
  
    } catch (error) {
      console.error('RAG Error:', error);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      responseDiv.innerHTML = `
        <div class="alert alert-danger">
          <h5><i class="fas fa-exclamation-triangle"></i> Connection Error</h5>
          <p><strong>${error.message}</strong></p>
          <hr>
          <p class="mb-2"><strong>Troubleshooting Steps:</strong></p>
          <ol class="text-start small mb-2">
            <li>Check if server is running</li>
            <li>Verify Cloudflare tunnel is active</li>
            <li>Check browser console (F12) for detailed errors</li>
          </ol>
          <div class="alert alert-theme-warning mb-0 mt-3">
            <strong>Time elapsed:</strong> ${duration}s
          </div>
        </div>
      `;
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-search"></i> Search & Answer';
    }
  }