import { ENV } from "../config/env";
import { generateDeviceId } from "../utils/device";
import { buildHeaders } from "../utils/headers";
import {
  type CsvRow,
  validateRow,
  loadCsvRecords,
} from "../utils/csv-helpers";
import { RegistrationService } from "./registration.service";

export type AppLogger = {
  info: (obj: any, msg?: string) => void;
  warn: (obj: any, msg?: string) => void;
  error: (obj: any, msg?: string) => void;
  debug: (obj: any, msg?: string) => void;
  child?: (obj: any) => AppLogger;
};

export type WorkerCtx = {
  logId: number;
  logger: AppLogger;
};

export class RegisterCsvWorker {
  private readonly logger: AppLogger;
  private readonly logId: number;
  private readonly registrationService: RegistrationService;

  private success = 0;
  private pending = 0;
  private fail = 0;
  private skipped = 0;

  private readonly seenIdentifiers = new Set<string>();

  constructor(ctx: WorkerCtx) {
    this.logId = ctx.logId;
    this.logger = ctx.logger;
    this.registrationService = new RegistrationService();
  }

  async run(filePath: string) {
    const records = loadCsvRecords(filePath);
    const limit = Number(ENV.CONCURRENCY);
    const activePromises: Promise<void>[] = [];

    for (let i = 0; i < records.length; i++) {
      if (activePromises.length >= limit) {
        await Promise.race(activePromises);
      }

      const p = this.processRow(records[i], i).then(() => { });
      const wrapper = p.finally(() => {
        const idx = activePromises.indexOf(wrapper);
        if (idx !== -1) activePromises.splice(idx, 1);
      });

      activePromises.push(wrapper);
    }

    await Promise.all(activePromises);

    return {
      success: this.success,
      pending: this.pending,
      fail: this.fail,
      skipped: this.skipped,
    };
  }

  private buildRequestHeaders(deviceId: string) {
    return buildHeaders(deviceId, "mobile");
  }

  private async processRow(row: CsvRow, index: number) {
    const deviceId = generateDeviceId();
    const rowCheck = validateRow(row, this.seenIdentifiers);

    if (!rowCheck.valid || !rowCheck.identifier) {
      this.skipped++;
      console.log(`⏭️ SKIP ROW ${index + 1}: ${rowCheck.reason}`);
      return;
    }

    const identifier = rowCheck.identifier;
    const phone = rowCheck.phone;
    this.seenIdentifiers.add(identifier);

    const headers = this.buildRequestHeaders(deviceId);

    const result = await this.registrationService.executeRegistrationFlow(
      row,
      index,
      identifier,
      phone,
      deviceId,
      headers,
      this.logger
    );

    if (result.status === "success") {
      this.success++;
    } else if (result.status === "pending") {
      this.pending++;
    } else if (result.status === "fail") {
      this.fail++;
    }
  }
}