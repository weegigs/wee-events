#!/usr/bin/env tsx

/**
 * Dependency Update Helper Script
 * 
 * This script helps manage dependencies across the monorepo:
 * 1. Check for outdated dependencies across all packages
 * 2. Update catalog versions in root package.json
 * 3. Verify consistency across packages
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

interface PackageJson {
  name: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  pnpm?: {
    catalog?: Record<string, string>;
  };
}

interface OutdatedInfo {
  current: string;
  latest: string;
  wanted: string;
  dependencyType: string;
}

interface OutdatedPackages {
  [packageName: string]: {
    [dependencyName: string]: OutdatedInfo;
  };
}

interface PackageInfo {
  name: string;
  version: string;
  path: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface ConsistencyIssue {
  package: string;
  dependency: string;
  current: string;
  shouldBe: string;
}

const rootDir = resolve(process.cwd());

function execCommand(command: string, options: Record<string, any> = {}): string | null {
  try {
    return execSync(command, { 
      encoding: 'utf8', 
      stdio: 'pipe',
      cwd: rootDir,
      ...options 
    }).trim();
  } catch (error) {
    console.error(`Error executing: ${command}`);
    console.error((error as Error).message);
    return null;
  }
}

function readPackageJson(path: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    console.error(`Error reading ${path}:`, (error as Error).message);
    return null;
  }
}

function writePackageJson(path: string, content: PackageJson): boolean {
  try {
    writeFileSync(path, JSON.stringify(content, null, 2) + '\n');
    return true;
  } catch (error) {
    console.error(`Error writing ${path}:`, (error as Error).message);
    return false;
  }
}

function checkOutdated(): OutdatedPackages | null {
  console.log('🔍 Checking for outdated dependencies...\n');
  
  const result = execCommand('pnpm outdated --format=json');
  if (!result) {
    console.log('✅ All dependencies are up to date!');
    return null;
  }
  
  try {
    const outdated: OutdatedPackages = JSON.parse(result);
    const packages = Object.keys(outdated);
    
    packages.forEach(pkg => {
      const info = outdated[pkg];
      console.log(`📦 ${pkg}`);
      Object.keys(info).forEach(dep => {
        const depInfo = info[dep];
        console.log(`  ${dep}: ${depInfo.current} → ${depInfo.latest}`);
      });
      console.log('');
    });
    
    return outdated;
  } catch (error) {
    console.error('Error parsing outdated dependencies:', (error as Error).message);
    return null;
  }
}

function updateCatalog(updates: Record<string, string> = {}): boolean {
  console.log('📝 Updating catalog...\n');
  
  const rootPkg = readPackageJson(resolve(rootDir, 'package.json'));
  if (!rootPkg) return false;
  
  const catalog = rootPkg.pnpm?.catalog || {};
  let updated = false;
  
  Object.keys(updates).forEach(dep => {
    if (catalog[dep]) {
      const oldVersion = catalog[dep];
      catalog[dep] = `^${updates[dep]}`;
      console.log(`✓ ${dep}: ${oldVersion} → ${catalog[dep]}`);
      updated = true;
    }
  });
  
  if (updated) {
    if (!rootPkg.pnpm) rootPkg.pnpm = {};
    rootPkg.pnpm.catalog = catalog;
    writePackageJson(resolve(rootDir, 'package.json'), rootPkg);
    console.log('\n✅ Catalog updated successfully!');
  } else {
    console.log('ℹ️  No catalog entries to update.');
  }
  
  return updated;
}

function verifyCatalogConsistency(): boolean {
  console.log('\n🔍 Verifying catalog consistency...\n');
  
  const rootPkg = readPackageJson(resolve(rootDir, 'package.json'));
  if (!rootPkg?.pnpm?.catalog) {
    console.log('⚠️  No catalog found in root package.json');
    return false;
  }
  
  const catalog = rootPkg.pnpm.catalog;
  const catalogDeps = Object.keys(catalog);
  
  // Get all package.json files
  const workspaces = execCommand('pnpm list --recursive --json --depth=-1');
  if (!workspaces) return false;
  
  try {
    const packages: PackageInfo[] = JSON.parse(workspaces);
    const issues: ConsistencyIssue[] = [];
    
    packages.forEach(pkg => {
      if (pkg.name === rootPkg.name) return; // Skip root package
      
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies
      };
      
      Object.keys(allDeps).forEach(dep => {
        if (catalogDeps.includes(dep)) {
          const version = allDeps[dep];
          if (version !== 'catalog:') {
            issues.push({
              package: pkg.name,
              dependency: dep,
              current: version,
              shouldBe: 'catalog:'
            });
          }
        }
      });
    });
    
    if (issues.length === 0) {
      console.log('✅ All packages are using catalog: consistently!');
      return true;
    } else {
      console.log('⚠️  Found inconsistencies:');
      issues.forEach(issue => {
        console.log(`  ${issue.package}: ${issue.dependency} = ${issue.current} (should be catalog:)`);
      });
      return false;
    }
  } catch (error) {
    console.error('Error verifying consistency:', (error as Error).message);
    return false;
  }
}

function syncCatalogVersions(): boolean {
  console.log('🔄 Syncing catalog with latest versions...\n');
  
  const rootPkg = readPackageJson(resolve(rootDir, 'package.json'));
  if (!rootPkg?.pnpm?.catalog) {
    console.log('⚠️  No catalog found in root package.json');
    return false;
  }
  
  const outdated = checkOutdated();
  if (!outdated) {
    console.log('✅ All catalog dependencies are up to date!');
    return true;
  }
  
  const catalog = rootPkg.pnpm.catalog;
  let updated = false;
  
  // Check if any catalog dependencies are outdated
  Object.keys(outdated).forEach(packageName => {
    const packageOutdated = outdated[packageName];
    Object.keys(packageOutdated).forEach(dep => {
      if (catalog[dep]) {
        const info = packageOutdated[dep];
        const oldVersion = catalog[dep];
        catalog[dep] = `^${info.latest}`;
        console.log(`✓ ${dep}: ${oldVersion} → ${catalog[dep]}`);
        updated = true;
      }
    });
  });
  
  if (updated) {
    rootPkg.pnpm.catalog = catalog;
    writePackageJson(resolve(rootDir, 'package.json'), rootPkg);
    console.log('\n✅ Catalog synced with latest versions!');
    console.log('Run `pnpm install` to apply the updates.');
  }
  
  return updated;
}

function showUsage(): void {
  console.log(`
Dependency Update Helper

Usage:
  tsx scripts/update-deps.ts [command]

Commands:
  check        Check for outdated dependencies
  verify       Verify catalog consistency across packages
  sync         Sync catalog with latest dependency versions
  help         Show this help message

Examples:
  tsx scripts/update-deps.ts check
  tsx scripts/update-deps.ts verify
  tsx scripts/update-deps.ts sync
`);
}

// Main execution
const command = process.argv[2] || 'check';

switch (command) {
  case 'check':
    checkOutdated();
    break;
    
  case 'verify':
    verifyCatalogConsistency();
    break;
    
  case 'sync':
    syncCatalogVersions();
    break;
    
  case 'help':
  case '--help':
  case '-h':
    showUsage();
    break;
    
  default:
    console.error(`Unknown command: ${command}`);
    showUsage();
    process.exit(1);
}