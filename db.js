const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data.sqlite');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY,
    until_ts INTEGER NOT NULL
  )`);
});

module.exports = {
  getAll: () => new Promise((res, rej) => {
    db.all('SELECT user_id, until_ts FROM subscriptions', (err, rows) => {
      if (err) return rej(err);
      res(rows);
    });
  }),
  get: (user_id) => new Promise((res, rej) => {
    db.get('SELECT user_id, until_ts FROM subscriptions WHERE user_id = ?', [user_id], (err, row) => {
      if (err) return rej(err);
      res(row);
    });
  }),
  set: (user_id, until_ts) => new Promise((res, rej) => {
    db.run('INSERT INTO subscriptions(user_id, until_ts) VALUES(?, ?) ON CONFLICT(user_id) DO UPDATE SET until_ts=excluded.until_ts', [user_id, until_ts], function(err) {
      if (err) return rej(err);
      res(true);
    });
  }),
  remove: (user_id) => new Promise((res, rej) => {
    db.run('DELETE FROM subscriptions WHERE user_id = ?', [user_id], function(err) {
      if (err) return rej(err);
      res(true);
    });
  })
};
