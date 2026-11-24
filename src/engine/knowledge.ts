import type { KbLink, KnowledgeEntry, ModuleId, RemediationStep, Severity } from './types';

// ---------------------------------------------------------------------------
// Microsoft documentation references (Microsoft Learn / Support).
// ---------------------------------------------------------------------------
export const KB = {
  repairImage: { title: 'Repair a Windows image (DISM /RestoreHealth)', url: 'https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/repair-a-windows-image' },
  repairSource: { title: 'Configure a Windows repair source', url: 'https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/configure-a-windows-repair-source' },
  fixWuCorruption: { title: 'Fix Windows Update corruption errors by using DISM (KB947821)', url: 'https://learn.microsoft.com/en-us/troubleshoot/windows-server/deployment/fix-windows-update-errors' },
  sfc: { title: 'Use the System File Checker tool to repair missing or corrupted system files', url: 'https://support.microsoft.com/en-us/topic/use-the-system-file-checker-tool-to-repair-missing-or-corrupted-system-files-79aa86cb-ca52-166a-92a3-966e85d4094e' },
  wuErrorRef: { title: 'Windows Update error code reference', url: 'https://learn.microsoft.com/en-us/windows/deployment/update/windows-update-error-reference' },
  wuCommonErrors: { title: 'Windows Update common errors and mitigation', url: 'https://learn.microsoft.com/en-us/windows/deployment/update/windows-update-errors' },
  wuTroubleshooting: { title: 'Windows Update troubleshooting', url: 'https://learn.microsoft.com/en-us/windows/deployment/update/windows-update-troubleshooting' },
  winsxsCleanup: { title: 'Clean up the WinSxS folder', url: 'https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/clean-up-the-winsxs-folder' },
  winsxsSize: { title: 'Determine the actual size of the WinSxS folder', url: 'https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/determine-the-actual-size-of-the-winsxs-folder' },
  dismPackages: { title: 'DISM operating system package servicing command-line options', url: 'https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/dism-operating-system-package-servicing-command-line-options' },
  dismFeatures: { title: 'Enable or disable Windows features using DISM', url: 'https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/enable-or-disable-windows-features-using-dism' },
  ssu: { title: 'Servicing stack updates', url: 'https://learn.microsoft.com/en-us/windows/deployment/update/servicing-stack-updates' },
  systemErrors: { title: 'System error codes (Win32)', url: 'https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes' },
  whatIsDism: { title: 'What is DISM?', url: 'https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/what-is-dism' },
} satisfies Record<string, KbLink>;

// ---------------------------------------------------------------------------
// Reusable remediation steps
// ---------------------------------------------------------------------------
const S = {
  restoreHealth: { text: 'Repair the component store from Windows Update.', command: 'DISM /Online /Cleanup-Image /RestoreHealth' },
  restoreHealthSource: {
    text: 'Repair using a matching install.wim/esd (same build, edition and language) as the source, without Windows Update.',
    command: 'DISM /Online /Cleanup-Image /RestoreHealth /Source:wim:X:\\sources\\install.wim:1 /LimitAccess',
  },
  scanHealth: { text: 'Scan the component store for corruption (read-only).', command: 'DISM /Online /Cleanup-Image /ScanHealth' },
  checkHealth: { text: 'Quickly check whether corruption has been flagged.', command: 'DISM /Online /Cleanup-Image /CheckHealth' },
  sfc: { text: 'Re-verify protected system files after the store is healthy.', command: 'sfc /scannow' },
  reboot: { text: 'Restart Windows to let pending servicing operations finish, then retry.' },
  analyze: { text: 'Analyse component store size and whether cleanup is recommended.', command: 'DISM /Online /Cleanup-Image /AnalyzeComponentStore' },
  cleanup: { text: 'Remove superseded components to reclaim space and reduce servicing failures.', command: 'DISM /Online /Cleanup-Image /StartComponentCleanup' },
  checkDisk: { text: 'Check the system volume for file-system errors (schedules on next boot).', command: 'chkdsk C: /scan' },
  freeSpace: { text: 'Free at least 10 GB on the system drive (Storage Sense / Disk Cleanup).' },
  wuReset: {
    text: 'Reset Windows Update components (stop services, rename SoftwareDistribution & catroot2, restart services).',
    command: 'net stop wuauserv & net stop bits & net stop cryptsvc & ren %windir%\\SoftwareDistribution SoftwareDistribution.old & ren %windir%\\System32\\catroot2 catroot2.old & net start cryptsvc & net start bits & net start wuauserv',
  },
  ssu: { text: 'Install the latest Servicing Stack Update (or the combined LCU on Windows 10 21H2+/11) before retrying.' },
  services: { text: 'Ensure Windows Modules Installer (TrustedInstaller) and Windows Update services are not disabled.', command: 'sc config trustedinstaller start= demand & sc config wuauserv start= demand' },
  antivirus: { text: 'Temporarily disable third-party antivirus / endpoint protection that may lock servicing files, then retry.' },
  msCatalog: { text: 'Download the failing package from the Microsoft Update Catalog and install it manually.', command: 'DISM /Online /Add-Package /PackagePath:C:\\Temp\\windows10.0-kbXXXXXXX.msu' },
  reviewLog: { text: 'Inspect the surrounding log lines for the first failure; later errors are often cascading.' },
} satisfies Record<string, RemediationStep>;

type Def = Omit<KnowledgeEntry, 'code'>;

const def = (
  name: string,
  title: string,
  module: ModuleId,
  severity: Severity,
  description: string,
  causes: string[],
  steps: RemediationStep[],
  links: KbLink[],
): Def => ({ name, title, module, severity, description, causes, steps, links });

/** Known HRESULTs observed in CBS.log / DISM.log, keyed by lowercase code. */
const HRESULTS: Record<string, Def> = {
  '0x800f081f': def('CBS_E_SOURCE_MISSING', 'Repair source files could not be found', 'store', 'critical',
    'DISM or CBS needed a replacement payload to repair a corrupted component but could not locate it on Windows Update or the specified source.',
    ['Windows Update is unreachable or blocked by WSUS / Group Policy', 'Supplied /Source image does not match the installed build or edition', 'Feature payload was removed (Features on Demand)'],
    [S.restoreHealthSource, S.restoreHealth, S.sfc],
    [KB.repairSource, KB.repairImage, KB.fixWuCorruption]),
  '0x800f0906': def('CBS_E_DOWNLOAD_FAILURE', 'Source files could not be downloaded', 'wu', 'critical',
    'The servicing stack could not download required files from Windows Update.',
    ['No internet access or proxy blocks Windows Update', 'Group Policy points at WSUS which lacks the payload'],
    [S.restoreHealthSource, S.wuReset],
    [KB.repairSource, KB.wuCommonErrors]),
  '0x800f0907': def('CBS_E_GROUPPOLICY_DISALLOWED', 'Download blocked by Group Policy', 'dism', 'warning',
    'Group Policy prevents DISM from contacting Windows Update for repair content.',
    ['"Specify settings for optional component installation and component repair" policy is configured to block WU'],
    [{ text: 'Enable "Download repair content and optional features directly from Windows Update" in gpedit (Computer Configuration › Administrative Templates › System).' }, S.restoreHealthSource],
    [KB.repairSource]),
  '0x800f0922': def('CBS_E_INSTALLERS_FAILED', 'Advanced installer failed during update', 'wu', 'critical',
    'One of the advanced installers (generic commands) failed while installing an update. Commonly seen with insufficient System Reserved partition space or VPN/proxy issues.',
    ['System Reserved / EFI partition is nearly full', 'Connection to update servers dropped mid-install', '.NET Framework or Secure Boot components failed to configure'],
    [S.freeSpace, S.restoreHealth, S.reboot, S.msCatalog],
    [KB.wuCommonErrors, KB.wuTroubleshooting]),
  '0x800f0831': def('CBS_E_STORE_CORRUPTION', 'Component store corruption (missing manifest)', 'store', 'critical',
    'CBS could not find the manifest of a previously installed package needed to apply this update.',
    ['A prior update did not install correctly', 'Component store files were deleted or corrupted'],
    [S.restoreHealth, S.msCatalog, S.sfc],
    [KB.fixWuCorruption, KB.repairImage]),
  '0x80073712': def('ERROR_SXS_COMPONENT_STORE_CORRUPT', 'Component store is in an inconsistent state', 'store', 'critical',
    'The WinSxS component store is corrupt and must be repaired before updates can be applied.',
    ['Interrupted servicing operation', 'Disk or file-system errors', 'Manual deletion inside WinSxS'],
    [S.scanHealth, S.restoreHealth, S.sfc],
    [KB.fixWuCorruption, KB.repairImage]),
  '0x800736cc': def('ERROR_SXS_FILE_HASH_MISMATCH', 'Component file hash mismatch', 'store', 'critical',
    'A file in the component store does not match the hash recorded in its manifest.',
    ['File modified by third-party software', 'Disk corruption'],
    [S.restoreHealth, S.sfc, S.checkDisk],
    [KB.repairImage, KB.sfc]),
  '0x80073701': def('ERROR_SXS_ASSEMBLY_MISSING', 'Referenced assembly is missing', 'store', 'critical',
    'The servicing stack could not find an assembly referenced by a package.',
    ['Language pack or feature removed improperly', 'Component store corruption'],
    [S.restoreHealth, S.msCatalog],
    [KB.fixWuCorruption]),
  '0x8007371b': def('ERROR_SXS_TRANSACTION_CLOSURE_INCOMPLETE', 'Component transaction closure incomplete', 'store', 'critical',
    'One or more required members of a servicing transaction are not present.',
    ['Missing dependent components', 'Incomplete prior update'],
    [S.restoreHealth, S.sfc],
    [KB.fixWuCorruption]),
  '0x800f0900': def('CBS_E_XML_PARSER_FAILURE', 'Manifest XML parser failure', 'cbs', 'critical',
    'CBS failed to parse a package or component manifest.',
    ['Corrupt manifest in WinSxS\\Manifests'], [S.restoreHealth, S.sfc], [KB.repairImage]),
  '0x800f0805': def('CBS_E_INVALID_PACKAGE', 'Invalid package', 'wu', 'warning',
    'The package is not valid for this image (wrong architecture, edition or corrupted file).',
    ['Wrong .msu/.cab for the installed OS'], [S.msCatalog], [KB.dismPackages]),
  '0x800f081e': def('CBS_E_NOT_APPLICABLE', 'Package not applicable', 'wu', 'info',
    'The package does not apply to this image. Usually benign.',
    ['Update already superseded or wrong OS build'], [S.reviewLog], [KB.dismPackages]),
  '0x800f0823': def('CBS_E_NEW_SERVICING_STACK_REQUIRED', 'Newer servicing stack required', 'wu', 'critical',
    'This package requires a newer servicing stack than is installed.',
    ['Servicing Stack Update not installed'], [S.ssu, S.msCatalog], [KB.ssu]),
  '0x800f0920': def('CBS_E_HANG_DETECTED', 'Servicing hang detected', 'cbs', 'critical',
    'CBS detected that a servicing operation hung and was aborted.',
    ['Antivirus scanning servicing files', 'Slow or failing disk'], [S.antivirus, S.checkDisk, S.reboot], [KB.wuTroubleshooting]),
  '0x800f0821': def('CBS_E_ABORT', 'Servicing operation aborted', 'cbs', 'warning',
    'The servicing operation was aborted (often by timeout or shutdown).',
    ['System shut down during servicing'], [S.reboot, S.restoreHealth], [KB.wuTroubleshooting]),
  '0x800f0982': def('PSFX_E_MATCHING_COMPONENT_NOT_FOUND', 'Matching component not found', 'store', 'critical',
    'Express/PSFX update could not find a matching component to apply a delta against.',
    ['Language packs or features installed after the base build', 'Component store corruption'],
    [S.restoreHealth, S.msCatalog], [KB.fixWuCorruption]),
  '0x80070002': def('ERROR_FILE_NOT_FOUND', 'File not found', 'cbs', 'warning',
    'A required file was not found. Frequently benign when probing optional paths, but significant when it repeats during package installs.',
    ['Missing payload or manifest', 'Cleaned temp folder during install'], [S.reviewLog, S.restoreHealth], [KB.systemErrors]),
  '0x80070003': def('ERROR_PATH_NOT_FOUND', 'Path not found', 'cbs', 'warning',
    'A required directory path was not found.', ['Missing folder in WinSxS or SoftwareDistribution'], [S.reviewLog, S.restoreHealth], [KB.systemErrors]),
  '0x80070005': def('E_ACCESSDENIED', 'Access denied', 'cbs', 'critical',
    'The servicing stack was denied access to a file or registry key.',
    ['Antivirus or endpoint protection lock', 'Broken ACLs on system files'], [S.antivirus, S.reboot, S.restoreHealth], [KB.systemErrors]),
  '0x80070020': def('ERROR_SHARING_VIOLATION', 'File in use (sharing violation)', 'cbs', 'warning',
    'A file needed for servicing was locked by another process.', ['Antivirus, backup or indexing service holds a lock'], [S.antivirus, S.reboot], [KB.systemErrors]),
  '0x8007000d': def('ERROR_INVALID_DATA', 'Invalid data', 'store', 'critical',
    'Data read during servicing was invalid — often a corrupt manifest or registry value.', ['Component store or registry corruption'], [S.restoreHealth, S.sfc], [KB.repairImage]),
  '0x80070057': def('E_INVALIDARG', 'Invalid parameter', 'dism', 'warning',
    'An invalid argument was passed — typically a malformed DISM command line or path.', ['Typo in /Source path or index'], [S.reviewLog], [KB.repairImage]),
  '0x80070070': def('ERROR_DISK_FULL', 'Not enough disk space', 'wu', 'critical',
    'The disk is full; servicing cannot stage files.', ['System drive low on space'], [S.freeSpace, S.cleanup], [KB.winsxsCleanup]),
  '0x80070490': def('ERROR_NOT_FOUND', 'Element not found', 'store', 'critical',
    'A component or registry element expected by CBS was not found — classic component store corruption indicator.',
    ['Corrupt CBS registry or manifests'], [S.restoreHealth, S.sfc], [KB.fixWuCorruption]),
  '0x800706be': def('RPC_S_CALL_FAILED', 'Remote procedure call failed', 'cbs', 'warning',
    'An RPC call to the servicing stack failed, often because TrustedInstaller crashed.', ['TrustedInstaller crash'], [S.reboot, S.restoreHealth], [KB.systemErrors]),
  '0x80070641': def('ERROR_INSTALL_SERVICE_FAILURE', 'Installer service unavailable', 'wu', 'critical',
    'The Windows Installer / Modules Installer service could not be accessed.', ['Service disabled'], [S.services, S.reboot], [KB.wuTroubleshooting]),
  '0x80070422': def('ERROR_SERVICE_DISABLED', 'Required service is disabled', 'wu', 'critical',
    'A service required for servicing (Windows Update, BITS or TrustedInstaller) is disabled.', ['Service disabled by policy or tweak tools'], [S.services], [KB.wuCommonErrors]),
  '0x80070652': def('ERROR_INSTALL_ALREADY_RUNNING', 'Another installation is in progress', 'wu', 'warning',
    'Another install was already running.', ['Concurrent update or MSI install'], [S.reboot], [KB.wuCommonErrors]),
  '0x80070bc9': def('ERROR_FAIL_REBOOT_REQUIRED', 'Reboot required before servicing', 'wu', 'warning',
    'A previous operation requires a reboot before further servicing can proceed.', ['Pending servicing transaction'], [S.reboot], [KB.wuTroubleshooting]),
  '0x800705b4': def('ERROR_TIMEOUT', 'Operation timed out', 'cbs', 'warning',
    'A servicing operation timed out.', ['Slow disk, antivirus or large update'], [S.antivirus, S.reboot], [KB.systemErrors]),
  '0x80004005': def('E_FAIL', 'Unspecified failure', 'cbs', 'warning',
    'Generic failure. The real cause is usually logged on the lines just before this one.', ['Varies'], [S.reviewLog, S.restoreHealth], [KB.systemErrors]),
  '0x80240034': def('WU_E_DOWNLOAD_FAILED', 'Update download failed', 'wu', 'critical',
    'Windows Update failed to download an update.', ['Network or proxy problems', 'Corrupt SoftwareDistribution cache'], [S.wuReset], [KB.wuErrorRef, KB.wuCommonErrors]),
  '0x8024402c': def('WU_E_PT_WINHTTP_NAME_NOT_RESOLVED', 'Update server name not resolved', 'wu', 'critical',
    'DNS could not resolve the Windows Update / WSUS server.', ['DNS or proxy misconfiguration'], [{ text: 'Verify DNS and proxy settings (netsh winhttp show proxy).', command: 'netsh winhttp show proxy' }, S.wuReset], [KB.wuErrorRef]),
  '0x80240017': def('WU_E_NOT_APPLICABLE', 'Update not applicable', 'wu', 'info',
    'The update is not applicable to this computer.', ['Wrong OS build or already installed'], [S.reviewLog], [KB.wuErrorRef]),
};

/** Diagnostic patterns detected from log text (not tied to a single HRESULT). */
export const PATTERNS: Record<string, KnowledgeEntry> = {
  SFC_CANNOT_REPAIR: { code: 'SFC_CANNOT_REPAIR', ...def('SFC_CANNOT_REPAIR', 'SFC could not repair a protected file', 'sfc', 'critical',
    'System File Checker found a corrupted protected file but could not replace it because the store copy is also bad.',
    ['Component store copy of the file is corrupt'], [S.restoreHealth, S.restoreHealthSource, S.sfc], [KB.sfc, KB.repairImage]) },
  SFC_REPAIRED: { code: 'SFC_REPAIRED', ...def('SFC_REPAIRED', 'SFC repaired corrupted files', 'sfc', 'warning',
    'System File Checker found and repaired corrupted protected files. The system is repaired but the root cause should be investigated.',
    ['Disk errors, unexpected shutdowns or third-party modification'], [S.checkDisk, S.sfc], [KB.sfc]) },
  SFC_HASH_MISMATCH: { code: 'SFC_HASH_MISMATCH', ...def('SFC_HASH_MISMATCH', 'Protected file hash mismatch', 'integrity', 'warning',
    'The hash of a protected system file does not match its manifest.', ['File modified or corrupted'], [S.sfc, S.restoreHealth], [KB.sfc]) },
  CSI_PAYLOAD_CORRUPT: { code: 'CSI_PAYLOAD_CORRUPT', ...def('CSI_PAYLOAD_CORRUPT', 'Component store payload corrupt (not repaired)', 'store', 'critical',
    'The checker found corrupted payload files in WinSxS that could not be repaired.',
    ['Missing replacement payload', 'Windows Update not reachable during repair'], [S.restoreHealthSource, S.restoreHealth], [KB.repairSource, KB.repairImage]) },
  CSI_PAYLOAD_FIXED: { code: 'CSI_PAYLOAD_FIXED', ...def('CSI_PAYLOAD_FIXED', 'Component store payload corruption repaired', 'store', 'info',
    'Corrupted payload files in WinSxS were successfully repaired.', ['Prior corruption'], [S.sfc], [KB.repairImage]) },
  STORE_CORRUPTION: { code: 'STORE_CORRUPTION', ...def('STORE_CORRUPTION', 'Component store corruption detected', 'store', 'critical',
    'CBS or CSI reported that the component store (WinSxS) is corrupted.', ['Interrupted servicing, disk errors'], [S.restoreHealth, S.sfc], [KB.fixWuCorruption]) },
  STORE_REPAIRABLE: { code: 'STORE_REPAIRABLE', ...def('STORE_REPAIRABLE', 'Component store is repairable', 'integrity', 'warning',
    'DISM reports the component store is corrupted but repairable.', ['Detected corruption'], [S.restoreHealth, S.sfc], [KB.repairImage]) },
  STORE_NOT_REPAIRABLE: { code: 'STORE_NOT_REPAIRABLE', ...def('STORE_NOT_REPAIRABLE', 'Component store is NOT repairable', 'integrity', 'critical',
    'DISM reports the component store cannot be repaired online. An in-place upgrade (repair install) may be required.',
    ['Severe store corruption'], [S.restoreHealthSource, { text: 'If repair still fails, run an in-place upgrade (setup.exe from matching ISO, keep files and apps).' }], [KB.repairImage, KB.repairSource]) },
  SOURCE_NOT_FOUND: { code: 'SOURCE_NOT_FOUND', ...def('SOURCE_NOT_FOUND', 'DISM could not find source files', 'dism', 'critical',
    'DISM reported that the source files could not be found.', ['No reachable repair source'], [S.restoreHealthSource], [KB.repairSource]) },
  REBOOT_PENDING: { code: 'REBOOT_PENDING', ...def('REBOOT_PENDING', 'Reboot pending to complete servicing', 'wu', 'warning',
    'A servicing session requires a restart before changes take effect. Further servicing may fail until then.', ['Updates installed, awaiting restart'], [S.reboot], [KB.wuTroubleshooting]) },
  PENDING_XML: { code: 'PENDING_XML', ...def('PENDING_XML', 'Pending servicing transaction (pending.xml)', 'cbs', 'warning',
    'A pending servicing transaction exists. DISM /RestoreHealth and updates cannot proceed until it completes.', ['Interrupted reboot'], [S.reboot], [KB.wuTroubleshooting]) },
  DOWNLOAD_FAILED: { code: 'DOWNLOAD_FAILED', ...def('DOWNLOAD_FAILED', 'Failed to download payload', 'wu', 'warning',
    'Payload download from Windows Update failed during servicing.', ['Network, proxy or WSUS restrictions'], [S.wuReset, S.restoreHealthSource], [KB.wuCommonErrors]) },
  MANIFEST_CORRUPT: { code: 'MANIFEST_CORRUPT', ...def('MANIFEST_CORRUPT', 'Corrupt component manifest', 'store', 'critical',
    'A component manifest failed hash or parse validation.', ['Manifest corruption in WinSxS'], [S.restoreHealth, S.sfc], [KB.fixWuCorruption]) },
  TI_HANG: { code: 'TI_HANG', ...def('TI_HANG', 'TrustedInstaller hang/timeout', 'cbs', 'critical',
    'The Windows Modules Installer service hung or was terminated during servicing.', ['Antivirus interference, slow disk'], [S.antivirus, S.checkDisk, S.reboot], [KB.wuTroubleshooting]) },
  LOW_DISK: { code: 'LOW_DISK', ...def('LOW_DISK', 'Insufficient disk space', 'wu', 'critical',
    'Servicing reported insufficient disk space.', ['System drive nearly full'], [S.freeSpace, S.cleanup], [KB.winsxsCleanup]) },
  CLEANUP_RECOMMENDED: { code: 'CLEANUP_RECOMMENDED', ...def('CLEANUP_RECOMMENDED', 'Component store cleanup recommended', 'store', 'info',
    'AnalyzeComponentStore recommends running cleanup to remove superseded components.', ['Accumulated superseded updates'], [S.cleanup], [KB.winsxsCleanup, KB.winsxsSize]) },
  PACKAGE_FAILED: { code: 'PACKAGE_FAILED', ...def('PACKAGE_FAILED', 'Update package failed to install', 'wu', 'critical',
    'A Windows Update package failed during CBS processing.', ['See the HRESULT recorded with the failure'], [S.restoreHealth, S.msCatalog, S.wuReset], [KB.wuCommonErrors, KB.fixWuCorruption]) },
};

export const GENERIC_STEPS = S;

const SUCCESS_CODES = new Set(['0x00000000', '0x00000001', '0x80070bc2', '0x00000bc2', '0x800f0816']);
export function isSuccessCode(code: string): boolean {
  return SUCCESS_CODES.has(code.toLowerCase());
}

/** Decode an HRESULT into facility information for codes not in the KB. */
export function decodeHresult(code: string): { facility: string; win32?: number } {
  const n = parseInt(code, 16) >>> 0;
  const facility = (n >>> 16) & 0x1fff;
  const low = n & 0xffff;
  switch (facility) {
    case 7: return { facility: 'Win32', win32: low };
    case 0x0f: return { facility: 'CBS / Servicing' };
    case 0x24: return { facility: 'Windows Update' };
    case 0x0e: return { facility: 'SxS' };
    case 0: return { facility: 'General' };
    default: return { facility: `Facility ${facility}` };
  }
}

export function lookupHresult(code: string, nameHint?: string): KnowledgeEntry {
  const key = code.toLowerCase();
  const known = HRESULTS[key];
  if (known) return { code: key, ...known };
  const d = decodeHresult(key);
  const isCbs = d.facility === 'CBS / Servicing';
  const isWu = d.facility === 'Windows Update';
  const module: ModuleId = isWu ? 'wu' : isCbs ? 'cbs' : 'cbs';
  return {
    code: key,
    name: nameHint || (d.win32 !== undefined ? `WIN32_ERROR_${d.win32}` : 'UNKNOWN_HRESULT'),
    title: nameHint ? humanize(nameHint) : `${d.facility} error ${key}`,
    description:
      d.win32 !== undefined
        ? `HRESULT wrapping Win32 error ${d.win32}. Look it up in the system error code reference; the preceding log lines show which operation failed.`
        : `Unrecognised ${d.facility} HRESULT. Review the surrounding log lines for the failing operation.`,
    severity: 'warning',
    module,
    causes: ['See surrounding log lines'],
    steps: [S.reviewLog, S.restoreHealth],
    links: isWu ? [KB.wuErrorRef] : [KB.systemErrors],
  };
}

function humanize(name: string): string {
  return name
    .replace(/^(CBS_E_|ERROR_|E_|WU_E_|PSFX_E_|S_)/, '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function knownHresultCount(): number {
  return Object.keys(HRESULTS).length;
}
