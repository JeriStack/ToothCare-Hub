import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileSortControl } from '../../components/ui/MobileSortControl';

const SRC = path.resolve(__dirname, '..', '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'tests' ? [] : walk(full);
    return /\.jsx$/.test(entry.name) ? [full] : [];
  });
}

describe('responsive component contracts', () => {
  it('every file that renders <MobileSortControl> imports it (regression: pages crashed with ReferenceError)', () => {
    const offenders = walk(SRC).filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return source.includes('<MobileSortControl') && !/import\s+\{?\s*MobileSortControl/.test(source) && !file.endsWith('MobileSortControl.jsx');
    });
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });

  it('MobileSortControl exposes a labelled select and a reverse-direction button, and delegates to onSort', () => {
    const calls = [];
    render(
      <MobileSortControl
        sortBy="name"
        sortDir="ASC"
        onSort={(column) => calls.push(column)}
        options={[{ value: 'name', label: 'Name' }, { value: 'id', label: 'ID' }]}
      />
    );
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'id' } });
    fireEvent.click(screen.getByRole('button', { name: /ascending/i }));
    expect(calls).toEqual(['id', 'name']);
  });

  it('shared touch-target utilities exist in global.css', () => {
    const css = fs.readFileSync(path.join(SRC, 'styles', 'global.css'), 'utf8');
    expect(css).toMatch(/\.tch-tap\s*\{[^}]*min-block-size:\s*1\.5rem/);
    expect(css).toMatch(/\.tch-check\s*\{[^}]*inline-size:\s*1\.5rem/);
  });
});
