import { expect, test } from '@playwright/test';
import { defaultProject } from '../src/lib/schema';
import { projectStateSnapshot } from '../src/lib/projectState';

test('project snapshot ignores nested object key order', () => {
  const project = defaultProject();
  const reordered = {
    ...project,
    settings: Object.fromEntries(Object.entries(project.settings).reverse()),
    messages: project.messages.map(message => Object.fromEntries(Object.entries(message).reverse())),
  } as typeof project;
  expect(projectStateSnapshot(reordered)).toBe(projectStateSnapshot(project));
});

test('project snapshot preserves authored array order and zero-message state', () => {
  const project = defaultProject();
  expect(projectStateSnapshot({ ...project, messages: [...project.messages].reverse() })).not.toBe(projectStateSnapshot(project));
  expect(projectStateSnapshot({ ...project, messages: [] })).not.toBe(projectStateSnapshot(project));
});
