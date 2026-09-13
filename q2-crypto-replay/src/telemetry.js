// Frugal QA Lab — Q2 Telemetry & Security Audit Logger
import fs from 'fs';
import path from 'path';

export class SecurityTelemetry {
  constructor(moduleName = 'q2-crypto-replay') {
    this.moduleName = moduleName;
    this.startTime = Date.now();
    this.events = [];
    this.assertions = [];
    this.vulnerabilityAlerts = [];
  }

  log(category, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      relativeMs: Date.now() - this.startTime,
      category,
      message,
      metadata
    };
    this.events.push(entry);
    console.log(`[${entry.category}] ${entry.message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}`);
    return entry;
  }

  recordAssertion(description, passed, details = {}) {
    const record = {
      description,
      passed: Boolean(passed),
      details,
      timestamp: new Date().toISOString()
    };
    this.assertions.push(record);
    const statusTag = passed ? 'PASS' : 'FAIL';
    console.log(`[ASSERTION:${statusTag}] ${description}`);
    return record;
  }

  raiseVulnerabilityAlert(severity, title, details = {}) {
    const alert = {
      severity,
      title,
      details,
      timestamp: new Date().toISOString()
    };
    this.vulnerabilityAlerts.push(alert);
    console.error(`\n🚨 [HIGH_RISK_SECURITY_ALERT] ${title}`);
    console.error(`Details: ${JSON.stringify(details, null, 2)}\n`);
    return alert;
  }

  exportEvidence(outputDirs = []) {
    const allPassed = this.assertions.length > 0 && this.assertions.every(a => a.passed);
    const summary = {
      module: this.moduleName,
      executedAt: new Date().toISOString(),
      durationMs: Date.now() - this.startTime,
      overallStatus: allPassed ? 'PASSED' : 'FAILED',
      totalAssertions: this.assertions.length,
      passedAssertions: this.assertions.filter(a => a.passed).length,
      failedAssertions: this.assertions.filter(a => !a.passed).length,
      vulnerabilityAlerts: this.vulnerabilityAlerts,
      assertions: this.assertions,
      events: this.events
    };

    const formattedLog = this.events.map(e => `[${e.timestamp}] [${e.category.padEnd(24)}] ${e.message} ${JSON.stringify(e.metadata)}`).join('\n');

    for (const dir of outputDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(summary, null, 2), 'utf-8');
      fs.writeFileSync(path.join(dir, 'execution.log'), formattedLog, 'utf-8');
    }

    return summary;
  }
}
