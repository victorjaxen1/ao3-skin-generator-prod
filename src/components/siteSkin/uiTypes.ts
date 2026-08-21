export type MobilePane = 'preview' | 'customize';
export type PreviewMode = 'showcase' | 'inspect';

export type EditorSectionId =
  | 'colors'
  | 'typography'
  | 'shape'
  | 'header'
  | 'surface'
  | 'reading'
  | 'details';

export const EDITOR_SECTION_IDS: readonly EditorSectionId[] = [
  'colors',
  'typography',
  'shape',
  'header',
  'surface',
  'reading',
  'details',
];
