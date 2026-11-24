import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyseText, classifyModule, detectSource } from './analyzer';
import { aggregate } from './aggregate';
import { decodeHresult, lookupHresult } from './knowledge';
import { toCsv, toMarkdown, toHtml, toJson } from './report';

const dir = join(__dirname, 'samples');
const cbsText = readFileSync(join(dir, 'CBS.sample.log'), 'utf8');
const dismText = readFileSync(join(dir, 'DISM.sample.log'), 'utf8');

describe('line parsing', () => {
  it('detects log source from name and content', () => {
    expect(detectSource('CBS.log', '')).toBe('cbs');
    expect(detectSource('dism.log', '')).toBe('dism');
    expect(detectSource('unknown.txt', dismText)).toBe('dism');
    expect(detectSource('unknown.txt', cbsText)).toBe('cbs');
  });

  it('classifies modules', () => {
    expect(classifyModule('CSI', '[SR] Verifying 100 components', 'cbs')).toBe('sfc');
    expect(classifyModule('CSI', 'Creating NT transaction', 'cbs')).toBe('store');
    expect(classifyModule('CBS', 'Exec: Package: Package_for_KB5034441~31bf', 'cbs')).toBe('wu');
    expect(classifyModule('DISM', 'Executing command line', 'dism')).toBe('dism');
    expect(classifyModule('CBS', 'Total Detected Corruption: 3', 'cbs')).toBe('integrity');
  });

  it('counts levels and lines in CBS sample', () => {
    const r = analyseText('CBS.log', cbsText);
    expect(r.summary.lines).toBe(81);
    expect(r.summary.levels.Error).toBe(4);
    expect(r.summary.first).toBe(Date.UTC(2024, 2, 12, 9, 14, 2));
    expect(r.cbsSessions.length).toBe(3);
    expect(r.cbsSessions[0].version).toBe('10.0.19041.3990');
  });
});

describe('CBS diagnostics', () => {
  const r = analyseText('CBS.log', cbsText);
  const codes = r.findings.map((f) => f.code);

  it('extracts HRESULT findings', () => {
    expect(codes).toContain('0x800f0922');
    expect(codes).toContain('0x80073712');
    expect(codes).toContain('0x800f081f');
    expect(codes).not.toContain('0x00000000');
  });

  it('parses SFC runs', () => {
    expect(r.sfcRuns.length).toBe(1);
    const s = r.sfcRuns[0];
    expect(s.verified).toBe(200);
    expect(s.repairedFiles).toBe(1);
    expect(s.unrepairedFiles).toBe(1);
    expect(s.complete).toBe(true);
  });

  it('resolves CSI payload corruption from continuation lines', () => {
    const csi = r.corrupt.filter((c) => /^(amd64|wow64)_/.test(c.name));
    expect(csi).toHaveLength(3);
    expect(csi.filter((c) => c.status === 'unrepaired').map((c) => c.file).sort()).toEqual(['advapi32.dll', 'sechost.dll']);
    expect(csi.find((c) => c.file === 'cryptbase.dll')?.status).toBe('repaired');
  });

  it('parses the checker summary block', () => {
    expect(r.checker).toHaveLength(1);
    expect(r.checker[0]).toMatchObject({ result: '0x800f081f', totalDetected: 3, totalRepaired: 1, operation: 'Detect and Repair' });
    expect(r.checker[0].breakdown['CSI Payload']).toBe(3);
  });

  it('tracks package state', () => {
    const rollup = r.packages.find((p) => p.name.includes('RollupFix'));
    expect(rollup?.state).toBe('failed');
    expect(rollup?.hresult).toBe('0x800f0922');
  });

  it('flags reboot pending', () => {
    expect(codes).toContain('REBOOT_PENDING');
  });
});

describe('DISM diagnostics', () => {
  const r = analyseText('dism.log', dismText);
  it('parses sessions and operations', () => {
    expect(r.dismSessions.map((s) => s.operation)).toEqual(['CheckHealth', 'ScanHealth', 'RestoreHealth', 'AnalyzeComponentStore']);
    const restore = r.dismSessions[2];
    expect(restore.errors).toBe(3);
    expect(restore.result).toBe('0x800f081f');
    expect(restore.rebootRequired).toBe(false);
    expect(r.dismSessions[0].componentStoreState).toBe('repairable');
  });
  it('parses bare HRESULT=XXXXXXXX codes', () => {
    const line = r.dismSessions[2];
    expect(line.result).toBe('0x800f081f');
    expect(r.entries.find((e) => e.message.includes('HRESULT=800F081F'))?.hresult).toBe('0x800f081f');
  });
  it('detects source-missing and cleanup recommendation', () => {
    const codes = r.findings.map((f) => f.code);
    expect(codes).toEqual(expect.arrayContaining(['0x800f081f', 'SOURCE_NOT_FOUND', 'STORE_REPAIRABLE', 'CLEANUP_RECOMMENDED', '0x800f0906']));
  });
});

describe('aggregation', () => {
  const a = aggregate([analyseText('CBS.log', cbsText), analyseText('dism.log', dismText)]);

  it('splits findings per source and correlates shared HRESULTs', () => {
    expect(a.findings.find((f) => f.id === 'cbs:0x800f081f')).toBeTruthy();
    expect(a.findings.find((f) => f.id === 'dism:0x800f081f')).toBeTruthy();
    const shared = a.correlations.find((c) => c.kind === 'shared-hresult' && [c.a, c.b].includes('dism:0x800f081f'));
    expect(shared?.strength).toBe(1);
  });

  it('builds temporal and causal correlations across CBS and DISM', () => {
    expect(a.correlations.some((c) => c.kind === 'temporal')).toBe(true);
    expect(a.correlations.some((c) => c.kind === 'causal')).toBe(true);
  });

  it('scores module health from findings', () => {
    expect(a.modules.store.status).toBe('critical');
    expect(a.modules.integrity.status).toBe('critical');
    expect(a.overall.status).toBe('critical');
    expect(a.overall.score).toBeLessThan(50);
    for (const m of Object.values(a.modules)) {
      expect(m.score).toBeGreaterThanOrEqual(0);
      expect(m.score).toBeLessThanOrEqual(100);
      expect(m.rationale.length).toBeGreaterThan(0);
    }
  });

  it('derives repair stages from evidence', () => {
    const st = Object.fromEntries(a.stages.map((s) => [s.id, s.status]));
    expect(st.scan).toBe('passed');
    expect(st.detect).toBe('warning');
    expect(st.source).toBe('failed');
    expect(st.repair).toBe('failed');
    expect(st.verify).toBe('failed');
    expect(st.commit).toBe('failed');
  });

  it('produces an ordered plan preferring /Source when WU cannot supply payloads', () => {
    const ids = a.plan.map((p) => p.id);
    expect(ids).toContain('restore-src');
    expect(ids.indexOf('restore-src')).toBeLessThan(ids.indexOf('sfc'));
    expect(ids[0]).toBe('reboot');
    expect(a.plan.every((p, i) => p.order === i + 1)).toBe(true);
  });

  it('yields no-data modules when only one log is supplied', () => {
    const only = aggregate([analyseText('dism.log', dismText)]);
    expect(only.modules.cbs.status).toBe('no-data');
    expect(only.modules.sfc.status).toBe('no-data');
  });

  it('exports reports in all formats', () => {
    expect(JSON.parse(toJson(a)).overall.score).toBe(a.overall.score);
    expect(toCsv(a).split('\n')[0]).toContain('severity');
    expect(toMarkdown(a)).toContain('# CBS & DISM Diagnostic Report');
    const html = toHtml(a);
    expect(html).toContain('<!doctype html>');
    expect(html).not.toContain('<script');
  });
});

describe('knowledge base', () => {
  it('decodes unknown HRESULTs', () => {
    expect(decodeHresult('0x80070643')).toEqual({ facility: 'Win32', win32: 1603 });
    const e = lookupHresult('0x80070643');
    expect(e.title).toContain('Win32');
    expect(e.links.length).toBeGreaterThan(0);
  });
  it('uses CBS name hints for unknown codes', () => {
    expect(lookupHresult('0x800f0999', 'CBS_E_SOMETHING_ODD').title).toBe('Something odd');
  });
});
