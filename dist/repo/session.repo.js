"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearPendingSession = clearPendingSession;
const database_1 = require("../config/database");
async function clearPendingSession(phone) {
    const conn = await database_1.mysqlPool.getConnection();
    try {
        await conn.query("DELETE FROM pending_registrations WHERE phone = ?", [phone]);
    }
    catch (err) {
        // ignore error if table doesn't exist or other DB issues (log silently if needed)
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=session.repo.js.map