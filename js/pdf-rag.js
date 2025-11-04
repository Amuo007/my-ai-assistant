// PDF Ask (unchanged logic)
async function askPDF() {
    const promptInput = document.getElementById('pdfPrompt');
    const responseDiv = document.getElementById('pdfResponse');
    const button = document.getElementById('pdfBtn');
    const chunksSlider = document.getElementById('pdfChunks');
  
    const question = promptInput.value.trim();
    if (!question) {
      responseDiv.innerHTML = `
        <div class="alert alert-warning">
          <i class="fas fa-exclamation-circle"></i> Please enter a question
        </div>`;
      return;
    }
  
    const topK = parseInt(chunksSlider.value);
  
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
  
    // Initialize status display
    responseDiv.innerHTML = `
      <div class="status-progress">
        <div class="status-step active" id="pdf-step-searching">
          <i class="fas fa-spinner fa-spin me-2"></i> Searching ${topK} chunks...
        </div>
        <div class="status-step" id="pdf-step-generating">
          <i class="far fa-circle me-2"></i> Generating answer...
        </div>
      </div>
      <div id="pdfStreamContent"></div>
    `;
  
    const streamContent = document.getElementById('pdfStreamContent');
    const startTime = Date.now();
    let fullAnswer = '';
    let metadata = null;
  
    try {
      const response = await fetch(`${API_URL}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question,
          config: {
            topK: topK,
            embeddingModel: 'nomic-embed-text',
            llmModel: 'llama3.2:1b'
          }
        }),
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
        buffer = lines.pop() || '';
  
        for (const line of lines) {
          if (!line.trim()) continue;
  
          try {
            const data = JSON.parse(line);
  
            // Handle status updates
            if (data.status) {
              if (data.status === 'generating') {
                markStepComplete('pdf-step-searching');
                const el = document.getElementById('pdf-step-generating');
                if (el) {
                  el.className = 'status-step active';
                  el.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Generating answer...';
                }
              }
            }
  
            // Handle metadata
            if (data.metadata) {
              metadata = data.metadata;
            }
  
            // Handle streaming chunks
            if (data.chunk) {
              if (fullAnswer === '') {
                streamContent.innerHTML = `
                  <div class="alert alert-light mt-3">
                    <h5><i class="fas fa-lightbulb"></i> Answer:</h5>
                    <p id="pdfAnswerText" style="white-space: pre-wrap;"><span class="blinking-cursor">▊</span></p>
                  </div>
                `;
              }
              fullAnswer += data.chunk;
              const answerEl = document.getElementById('pdfAnswerText');
              if (answerEl) {
                answerEl.innerHTML = escapeHtml(fullAnswer) + '<span class="blinking-cursor">▊</span>';
              }
            }
  
            // Handle completion
            if (data.done) {
              const cursor = document.querySelector('.blinking-cursor');
              if (cursor) cursor.remove();
  
              const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
              let html = `
                <div class="alert alert-success mb-3">
                  <i class="fas fa-check-circle"></i> Answer generated in ${duration}s using ${topK} chunks
                </div>
                
                <div class="alert alert-light">
                  <h5><i class="fas fa-lightbulb"></i> Answer:</h5>
                  <p style="white-space: pre-wrap;">${escapeHtml(fullAnswer)}</p>
                </div>
              `;
  
              if (metadata && metadata.sources) {
                html += '<h6 class="mt-3"><i class="fas fa-file-pdf"></i> Sources Used:</h6>';
                metadata.sources.forEach(source => {
                  const filename = source.split('/').pop();
                  html += `
                    <span class="badge bg-secondary me-2 mb-2">
                      <i class="fas fa-file"></i> ${escapeHtml(filename)}
                    </span>
                  `;
                });
              }
  
              if (metadata && metadata.relevantChunks) {
                html += `
                  <div class="mt-3">
                    <h6><i class="fas fa-puzzle-piece"></i> Retrieved Chunks (${metadata.relevantChunks.length}):</h6>
                `;
                metadata.relevantChunks.forEach((chunk, i) => {
                  html += `
                    <div class="card mb-2">
                      <div class="card-body p-2">
                        <small>
                          <strong>#${i + 1}</strong> - 
                          <span class="badge badge-gradient">${(chunk.similarity * 100).toFixed(1)}% match</span>
                          <span class="text-muted">from ${escapeHtml(chunk.source.split('/').pop())}</span>
                          <br>
                          <span class="text-muted">${escapeHtml(chunk.preview)}</span>
                        </small>
                      </div>
                    </div>
                  `;
                });
                html += '</div>';
              }
  
              html += `
                <div class="mt-3 p-2 rounded rag-metadata">
                  <small class="text-muted">
                    <i class="fas fa-info-circle"></i> 
                    <strong>Stats:</strong> 
                    ${metadata.totalEmbeddings || 0} total chunks | 
                    ${metadata.relevantChunks ? metadata.relevantChunks.length : 0} chunks used | 
                    ${duration}s response time
                  </small>
                </div>
              `;
  
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
            console.error('Parse error:', e);
          }
        }
      }
  
    } catch (error) {
      console.error('PDF Ask Error:', error);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      responseDiv.innerHTML = `
        <div class="alert alert-danger">
          <h5><i class="fas fa-exclamation-triangle"></i> Error</h5>
          <p>${error.message}</p>
          <hr>
          <small>
            <strong>Possible causes:</strong>
            <ul class="mb-0">
              <li>PDFs not indexed yet</li>
              <li>Server connection issue</li>
              <li>Qdrant database not accessible</li>
            </ul>
            Time elapsed: ${duration}s
          </small>
        </div>`;
    } finally {
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-question-circle"></i> Ask PDF';
    }
  }