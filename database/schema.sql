-- SaaS Mejorado Database Schema
-- Multi-tenant Sales Management Platform

-- ==================== AUTH & USERS ====================
CREATE TABLE IF NOT EXISTS saas_clients (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  website VARCHAR(255),
  industry VARCHAR(100),
  plan VARCHAR(50) DEFAULT 'starter',
  status VARCHAR(20) DEFAULT 'active',
  api_key VARCHAR(100) UNIQUE,
  webhook_url VARCHAR(255),
  max_users INT DEFAULT 10,
  max_leads INT DEFAULT 1000,
  storage_limit BIGINT DEFAULT 10737418240,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES saas_clients(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) DEFAULT 'salesperson',
  avatar_url VARCHAR(255),
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active',
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, email)
);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES saas_clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  manager_id INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales_leads (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES saas_clients(id) ON DELETE CASCADE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  company VARCHAR(255),
  source VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  value NUMERIC(12,2),
  currency VARCHAR(10) DEFAULT 'USD',
  probability NUMERIC(3,2) DEFAULT 0.5,
  status VARCHAR(50) DEFAULT 'new',
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_to INT REFERENCES users(id) ON DELETE SET NULL,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_logs (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES saas_clients(id) ON DELETE CASCADE,
  lead_id INT REFERENCES sales_leads(id) ON DELETE CASCADE,
  channel VARCHAR(50),
  sender VARCHAR(100),
  sender_id VARCHAR(100),
  message TEXT,
  response TEXT,
  ai_model VARCHAR(50),
  tokens_used INT,
  sentiment VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES saas_clients(id) ON DELETE CASCADE,
  lead_id INT REFERENCES sales_leads(id) ON DELETE CASCADE,
  type VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_configs (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES saas_clients(id) ON DELETE CASCADE,
  channel VARCHAR(50) NOT NULL,
  bot_token VARCHAR(255) NOT NULL,
  webhook_url VARCHAR(255),
  system_prompt TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(client_id, channel)
);

CREATE TABLE IF NOT EXISTS sales_metrics (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES saas_clients(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  total_leads INT DEFAULT 0,
  new_leads INT DEFAULT 0,
  qualified_leads INT DEFAULT 0,
  closed_deals INT DEFAULT 0,
  revenue NUMERIC(15,2) DEFAULT 0,
  avg_deal_value NUMERIC(12,2) DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==================== INDEXES ====================
CREATE INDEX idx_users_client ON users(client_id);
CREATE INDEX idx_leads_client ON sales_leads(client_id);
CREATE INDEX idx_leads_assigned ON sales_leads(assigned_to);
CREATE INDEX idx_leads_created ON sales_leads(created_at);
CREATE INDEX idx_chat_logs_client ON chat_logs(client_id);
CREATE INDEX idx_chat_logs_created ON chat_logs(created_at);
CREATE INDEX idx_metrics_date ON sales_metrics(date);
