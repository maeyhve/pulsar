#!/usr/bin/env node
/**
 * Sets up a local n8n checkout.
 *
 * The script checks the Node.js version. When the version cannot build
 * `isolated-vm`, the script installs Node.js 24 or 26 through pnpm and
 * restarts itself with that runtime. Then it runs `pnpm install`. Use
 * `--build` to build the repo after the install.
 *
 * `isolated-vm` ships prebuilds only for Node.js 24 (ABI 137) and Node.js 26
 * (ABI 147). Node.js 25 is not supported.
 *
 * Usage:
 *   pnpm setup:local [--node 24|26] [--build]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SCRIPT_PATH = import.meta.filename;
const SUPPORTED_NODE_MAJORS = [24, 26];
const DEFAULT_NODE_MAJOR = 26;
const REEXEC_ENV = 'N8N_LOCAL_SETUP_REEXEC';
const isWindows = process.platform === 'win32';

const USAGE = `Usage: pnpm setup:local [flags]

Checks the Node.js version, installs Node.js 24 or 26 when needed, then runs
pnpm install.

Flags:
  --node <24|26>  Node.js major version to install when needed (default: 26)
  --build         Run pnpm build after the install
  -h, --help      Show this help
`;

let values;
try {
	({ values } = parseArgs({
		options: {
			node: { type: 'string', default: String(DEFAULT_NODE_MAJOR) },
			build: { type: 'boolean', default: false },
			help: { type: 'boolean', short: 'h', default: false },
		},
		strict: true,
	}));
} catch (error) {
	fail(error.message);
}

if (values.help) {
	process.stdout.write(USAGE);
	process.exit(0);
}

const targetMajor = Number(values.node);
if (!SUPPORTED_NODE_MAJORS.includes(targetMajor)) {
	fail(`--node must be one of: ${SUPPORTED_NODE_MAJORS.join(', ')}`);
}

if (!hasPnpm()) {
	fail('pnpm is not available. Install pnpm 12.4.2 with "npm i -g pnpm@12.4.2".');
}

const currentMajor = Number(process.versions.node.split('.')[0]);
if (!SUPPORTED_NODE_MAJORS.includes(currentMajor)) {
	if (process.env[REEXEC_ENV] === '1') {
		fail(
			`Node.js ${process.versions.node} is not supported. Install Node.js ${targetMajor} or add the pnpm global bin directory to PATH.`,
		);
	}
	switchNode(targetMajor);
}

log(`Using Node.js ${process.versions.node}.`);
runInstall();
if (values.build) {
	runBuild();
}
log('Local setup finished.');

function fail(message) {
	process.stderr.write(`setup-local: ${message}\n`);
	process.exit(1);
}

function log(message) {
	process.stdout.write(`${message}\n`);
}

/** Runs a pnpm command. A shell is required on Windows to resolve pnpm.cmd. */
function pnpm(args, options = {}) {
	if (isWindows) {
		return spawnSync(['pnpm', ...args].join(' '), {
			shell: true,
			cwd: REPO_ROOT,
			...options,
		});
	}
	return spawnSync('pnpm', args, { cwd: REPO_ROOT, ...options });
}

function hasPnpm() {
	const result = pnpm(['-v'], { encoding: 'utf8' });
	return result.status === 0;
}

function globalBinDir() {
	const result = pnpm(['bin', '-g'], { encoding: 'utf8' });
	if (result.status !== 0) {
		fail('Cannot read the pnpm global bin directory. Run "pnpm bin -g" and try again.');
	}
	const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
	if (lines.length === 0) {
		fail('The pnpm global bin directory is empty.');
	}
	return lines[lines.length - 1].trim();
}

function findNode(binDir) {
	const names = isWindows ? ['node.exe', 'node'] : ['node'];
	for (const name of names) {
		const candidate = join(binDir, name);
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

function switchNode(major) {
	log(`Node.js ${process.versions.node} cannot build isolated-vm. Installing Node.js ${major}.`);
	const install = pnpm(['runtime', 'set', 'node', String(major), '-g'], { stdio: 'inherit' });
	if (install.status !== 0) {
		fail(
			`Cannot install Node.js ${major} through pnpm. Install Node.js ${major} from https://nodejs.org and run this script again.`,
		);
	}

	const binDir = globalBinDir();
	const nodePath = findNode(binDir);
	if (!nodePath) {
		fail(
			`Cannot find the Node.js ${major} binary in ${binDir}. Add that directory to PATH and run this script again.`,
		);
	}

	log(`Restarting with ${nodePath}.`);
	const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
	const child = spawnSync(nodePath, [SCRIPT_PATH, ...process.argv.slice(2)], {
		cwd: REPO_ROOT,
		stdio: 'inherit',
		env: {
			...process.env,
			[REEXEC_ENV]: '1',
			[pathKey]: `${binDir}${delimiter}${process.env[pathKey] ?? ''}`,
		},
	});
	if (child.error) {
		fail(child.error.message);
	}
	process.exit(child.status ?? 1);
}

function runInstall() {
	log('Installing dependencies.');
	const result = pnpm(['install'], { stdio: 'inherit' });
	if (result.error) {
		fail(result.error.message);
	}
	if (result.status !== 0) {
		fail('pnpm install failed. Read the output above.');
	}
}

function runBuild() {
	log('Building the repo.');
	const result = pnpm(['build'], { stdio: 'inherit' });
	if (result.error) {
		fail(result.error.message);
	}
	if (result.status !== 0) {
		fail('pnpm build failed. Read the output above.');
	}
}
