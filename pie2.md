# 1. Installed Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
# Result: Docker engine installed on Pi #2

# 2. Created storage directory
mkdir -p ~/qdrant_storage
# Result: Folder for Qdrant to store data

# 3. Ran Qdrant in Docker
sudo docker run -d \
  --name qdrant \
  -p 6333:6333 \
  --restart always \
  qdrant/qdrant
# Result: Qdrant server running 24/7 on Pi #2
```

---

### **What's Running Now on Pi #2:**
```
Pi #2 (192.168.1.178)
│
├─ Docker (container engine)
│   └─ Qdrant Container
│       ├─ HTTP Server on port 6333
│       ├─ REST API for vectors
│       ├─ Web Dashboard at /dashboard
│       └─ Storage: ~/qdrant_storage
│
└─ Auto-starts on boot (--restart always)
```

---

### **What Qdrant Does:**

- **Stores vectors** (embeddings) efficiently
- **Fast similarity search** using HNSW algorithm
- **REST API** so Pi #1 can talk to it over network
- **Persistent storage** (data survives reboots)

---

### **Pi #2's Job:**
```
Pi #1 asks: "Find similar vectors to this query"
    ↓
Pi #2 Qdrant: *searches 10,000 vectors in 0.5 seconds*
    ↓
Pi #2 replies: "Here are the top 4 most similar chunks"
