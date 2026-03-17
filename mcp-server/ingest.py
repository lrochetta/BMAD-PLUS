
import os
import shutil
import json
import logging
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
import git
import yaml

# Configuration
KNOWLEDGE_DIR = "knowledge"
SOURCES_FILE = os.path.join(KNOWLEDGE_DIR, "sources.json")
CHROMA_PATH = "chroma_db"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RAG-Ingest")

class RAGIngester:
    def __init__(self):
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.collection = self.chroma_client.get_or_create_collection(name="industrial_audit_norms")
        
    def fetch_sources(self):
        """Clone or Pull repositories defined in sources.json"""
        if not os.path.exists(SOURCES_FILE):
            logger.error(f"Sources file not found: {SOURCES_FILE}")
            return

        with open(SOURCES_FILE, 'r') as f:
            config = json.load(f)

        for source in config['sources']:
            logger.info(f"Processing source: {source['name']}")
            repo_path = os.path.join(KNOWLEDGE_DIR, "repos", source['id'])
            
            if os.path.exists(repo_path):
                logger.info(f"  -> Pulling updates for {source['name']}...")
                try:
                    repo = git.Repo(repo_path)
                    repo.remotes.origin.pull()
                except Exception as e:
                    logger.error(f"Failed to pull {source['name']}: {e}")
            else:
                logger.info(f"  -> Cloning {source['name']}...")
                try:
                    git.Repo.clone_from(source['url'], repo_path, branch=source.get('branch', 'master'))
                except Exception as e:
                    logger.error(f"Failed to clone {source['name']}: {e}")
            
            # Process content after fetch
            self.process_content(source, repo_path)

    def process_content(self, source_config, repo_path):
        """Parse and chunk content based on source format"""
        logger.info(f"  -> Indexing content for {source_config['name']}...")
        
        target_paths = source_config.get('paths', ['.'])
        fmt = source_config.get('format', 'text')
        
        documents = []
        metadatas = []
        ids = []

        for rel_path in target_paths:
            full_path = os.path.join(repo_path, rel_path)
            
            if os.path.isdir(full_path):
                for root, _, files in os.walk(full_path):
                    for file in files:
                        self._process_single_file(os.path.join(root, file), fmt, source_config, documents, metadatas, ids)
            elif os.path.isfile(full_path):
                self._process_single_file(full_path, fmt, source_config, documents, metadatas, ids)

        if documents:
            logger.info(f"  -> Embedding {len(documents)} chunks...")
            # Batch upsert
            batch_size = 100
            for i in range(0, len(documents), batch_size):
                batch_docs = documents[i:i+batch_size]
                batch_metas = metadatas[i:i+batch_size]
                batch_ids = ids[i:i+batch_size]
                
                embeddings = self.embedding_model.encode(batch_docs).tolist()
                self.collection.upsert(
                    documents=batch_docs,
                    embeddings=embeddings,
                    metadatas=batch_metas,
                    ids=batch_ids
                )
            logger.info("  -> Done.")

    def _process_single_file(self, file_path, fmt, config, docs, metas, ids):
        try:
            content = ""
            meta = {
                "source": config['id'],
                "type": config['tags'][0] if config['tags'] else "general",
                "file": os.path.basename(file_path)
            }
            
            if fmt == 'json' and file_path.endswith('.json'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Specialized parser for ASVS
                    if 'requirements' in data: # ASVS structure
                        for req in data['requirements']:
                            content_chunk = f"{req.get('id')} - {req.get('description')}"
                            docs.append(content_chunk)
                            meta_copy = meta.copy()
                            meta_copy['level'] = req.get('level', 'Unknown')
                            metas.append(meta_copy)
                            ids.append(f"{config['id']}-{req.get('id')}")
                        return # Handled
                        
            elif fmt == 'yaml' or file_path.endswith(('.yaml', '.yml')):
                with open(file_path, 'r', encoding='utf-8') as f:
                    # Semgrep rules
                    content = f.read()
                    # Naive chunking for now (file level)
                    
            elif fmt == 'markdown' or file_path.endswith('.md'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Split by headers (H2)
                    chunks = content.split('\n## ')
                    for i, chunk in enumerate(chunks):
                        if not chunk.strip(): continue
                        docs.append(chunk)
                        metas.append(meta)
                        ids.append(f"{config['id']}-{os.path.basename(file_path)}-{i}")
                    return

            # Default text handling
            if not content:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

            if content.strip():
                docs.append(content[:2000]) # Truncate large files
                metas.append(meta)
                ids.append(f"{config['id']}-{os.path.basename(file_path)}")

        except Exception as e:
            logger.warning(f"Skipping file {file_path}: {e}")

if __name__ == "__main__":
    ingester = RAGIngester()
    ingester.fetch_sources()
