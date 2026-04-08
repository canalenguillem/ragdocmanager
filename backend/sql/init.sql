CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  name        VARCHAR(100) NOT NULL,
  phone       VARCHAR(30) NULL,
  role        ENUM('user','admin') DEFAULT 'user',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_api_keys (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  provider    ENUM('openai','gemini','cohere','mistral') NOT NULL,
  key_type    ENUM('embedding','chat','both') NOT NULL DEFAULT 'both',
  api_key     VARBINARY(512) NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  verified_at DATETIME DEFAULT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_provider_type (user_id, provider, key_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_settings (
  user_id               INT PRIMARY KEY,
  embedding_provider    ENUM('openai','gemini','cohere','mistral') DEFAULT 'openai',
  embedding_model       VARCHAR(100) DEFAULT 'text-embedding-3-large',
  chat_provider         ENUM('openai','gemini') DEFAULT 'openai',
  chat_model            VARCHAR(100) DEFAULT 'gpt-4o',
  embedding_dimensions  INT DEFAULT 3072,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS documents (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT NOT NULL,
  folder_id         INT NULL,
  filename          VARCHAR(500) NOT NULL,
  original_name     VARCHAR(500) NOT NULL,
  file_size         BIGINT NOT NULL,
  page_count        INT DEFAULT 0,
  status            ENUM('pending','processing','ready','error') DEFAULT 'pending',
  error_msg         TEXT,
  qdrant_collection VARCHAR(100) NOT NULL DEFAULT 'rag_docs',
  embedding_provider VARCHAR(50) DEFAULT NULL,
  embedding_model   VARCHAR(100) DEFAULT NULL,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_folders (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(255) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_folder_name_per_user (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
