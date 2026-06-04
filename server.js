const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 初始化数据库
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'kiss.db');
console.log(`💾 数据库路径: ${DB_PATH}`);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS kisses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL CHECK(sender IN ('partner1','partner2')),
    date TEXT NOT NULL,
    period TEXT NOT NULL CHECK(period IN ('morning','night')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`);

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_kisses_unique
  ON kisses(sender, date, period)
`);

// 获取某天的 kiss 状态
app.get('/api/kiss/status', (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: '缺少 date 参数' });

  const rows = db.prepare(
    `SELECT sender, period, created_at FROM kisses WHERE date = ?`
  ).all(date);

  const status = {
    date,
    morning: { partner1: false, partner2: false },
    night:   { partner1: false, partner2: false }
  };

  for (const row of rows) {
    status[row.period][row.sender] = {
      sent: true,
      at: row.created_at
    };
  }

  res.json(status);
});

// 发送一个吻
app.post('/api/kiss', (req, res) => {
  const { sender, date, period } = req.body;
  if (!sender || !date || !period) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  if (!['partner1','partner2'].includes(sender)) {
    return res.status(400).json({ error: 'sender 必须是 partner1 或 partner2' });
  }
  if (!['morning','night'].includes(period)) {
    return res.status(400).json({ error: 'period 必须是 morning 或 night' });
  }

  try {
    const stmt = db.prepare(
      `INSERT INTO kisses (sender, date, period) VALUES (?, ?, ?)`
    );
    const info = stmt.run(sender, date, period);
    const row = db.prepare(`SELECT * FROM kisses WHERE id = ?`).get(info.lastInsertRowid);
    res.json({ success: true, kiss: row });
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: '今天这个时段的吻已经送过了 💋' });
    }
    res.status(500).json({ error: e.message });
  }
});

// 按日期范围查询历史记录
app.get('/api/kiss/history', (req, res) => {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: '缺少 start 或 end 参数' });

  const rows = db.prepare(
    `SELECT * FROM kisses WHERE date >= ? AND date <= ? ORDER BY date ASC, period ASC`
  ).all(start, end);

  res.json(rows);
});

// 按年份获取所有 kiss 数据（用于日历渲染）
app.get('/api/kiss/archive', (req, res) => {
  const year = req.query.year || new Date().getFullYear().toString();
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;

  const rows = db.prepare(
    `SELECT date, sender, period, created_at FROM kisses
     WHERE date >= ? AND date <= ?
     ORDER BY date ASC`
  ).all(start, end);

  res.json(rows);
});

// 获取近期统计
app.get('/api/kiss/stats', (req, res) => {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const weekStr = weekAgo.toISOString().slice(0,10);
  const monthStr = monthAgo.toISOString().slice(0,10);
  const todayStr = today.toISOString().slice(0,10);

  const weekKisses = db.prepare(
    `SELECT * FROM kisses WHERE date >= ? AND date <= ?`
  ).all(weekStr, todayStr);

  const monthKisses = db.prepare(
    `SELECT * FROM kisses WHERE date >= ? AND date <= ?`
  ).all(monthStr, todayStr);

  res.json({ week: weekKisses, month: monthKisses });
});

// fallback：所有未匹配路由返回 index.html（SPA 支持）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`💋 Kiss app 已启动: http://localhost:${PORT}`);
});
