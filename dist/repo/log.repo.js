"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureLogRow = ensureLogRow;
const database_1 = require("../config/database");
async function ensureLogRow(fileName, filePath) {
    const conn = await database_1.mysqlPool.getConnection();
    try {
        const [r] = await conn.query(`
      INSERT INTO tbl_log (file_name, file_path)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)
      `, [fileName, filePath]);
        return Number(r.insertId);
    }
    finally {
        conn.release();
    }
}
//# sourceMappingURL=log.repo.js.map