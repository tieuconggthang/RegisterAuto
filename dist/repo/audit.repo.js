"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserIdByPhone = findUserIdByPhone;
exports.insertUserAction = insertUserAction;
exports.insertAuthStatus = insertAuthStatus;
exports.getLastLoginSuccessAt = getLastLoginSuccessAt;
const database_1 = require("../config/database");
async function findUserIdByPhone(phone) {
    const conn = await database_1.mysqlPool.getConnection();
    try {
        const [rows] = await conn.query(`SELECT id FROM users WHERE phone = ? LIMIT 1`, [phone]);
        return rows?.[0]?.id ? Number(rows[0].id) : null;
    }
    finally {
        conn.release();
    }
}
async function insertUserAction(params) {
    const conn = await database_1.mysqlPool.getConnection();
    try {
        await conn.query(`INSERT INTO user_action (userId, action_name, detail, log_id) VALUES (?,?,?,?)`, [params.userId, params.actionName, params.detail ?? null, params.logId]);
    }
    finally {
        conn.release();
    }
}
async function insertAuthStatus(params) {
    const conn = await database_1.mysqlPool.getConnection();
    try {
        await conn.query(`
      INSERT INTO auth_status (action, phone, deviceId, userId, status, detail, log_id)
      VALUES (?,?,?,?,?,?,?)
      `, [
            params.action,
            params.phone,
            params.deviceId,
            params.userId,
            params.status,
            params.detail ?? null,
            params.logId,
        ]);
    }
    finally {
        conn.release();
    }
}
async function getLastLoginSuccessAt(userId) {
    const conn = await database_1.mysqlPool.getConnection();
    try {
        const [rows] = await conn.query(`
      SELECT createdAt FROM auth_status
      WHERE action='LOGIN' AND userId=? AND status=1
      ORDER BY createdAt DESC
      LIMIT 1
      `, [userId]);
        return rows?.[0]?.createdAt ? new Date(rows[0].createdAt) : null;
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=audit.repo.js.map