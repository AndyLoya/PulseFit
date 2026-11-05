const logs = [];
let sequence = 0;

function create(userId, input) {
  const log = {
    id: ++sequence,
    userId,
    ...input,
    createdAt: new Date().toISOString()
  };
  logs.push(log);
  return log;
}

module.exports = { create };
