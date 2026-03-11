import { useCallback } from 'react';
import { SkinProject, Message } from '../lib/schema';

/**
 * Shared hook for project editing operations
 * Eliminates code duplication across TwitterEditor, IOSEditor, and AndroidEditor
 * All functions are memoized with useCallback for optimal performance
 */
export function useProjectEditor(
  project: SkinProject, 
  onChange: (p: SkinProject) => void
) {
  /**
   * Update top-level project property
   */
  const update = useCallback(<K extends keyof SkinProject>(
    key: K, 
    value: SkinProject[K]
  ) => {
    onChange({ ...project, [key]: value });
  }, [project, onChange]);
  
  /**
   * Update settings property
   */
  const updateSettings = useCallback(<K extends keyof SkinProject['settings']>(
    key: K, 
    value: SkinProject['settings'][K]
  ) => {
    onChange({ ...project, settings: { ...project.settings, [key]: value } });
  }, [project, onChange]);
  
  /**
   * Update a specific message by ID
   */
  const updateMsg = useCallback((id: string, patch: Partial<Message>) => {
    const messages = project.messages.map(m => m.id === id ? { ...m, ...patch } : m);
    onChange({ ...project, messages });
  }, [project, onChange]);
  
  /**
   * Delete a message by ID
   */
  const deleteMsg = useCallback((id: string) => {
    const messages = project.messages.filter(m => m.id !== id);
    onChange({ ...project, messages });
  }, [project, onChange]);
  
  /**
   * Add a new message
   */
  const addMsg = useCallback((message: Message) => {
    onChange({ ...project, messages: [...project.messages, message] });
  }, [project, onChange]);
  
  /**
   * Add multiple messages at once (for Fast Mode)
   */
  const addMessages = useCallback((messages: Message[]) => {
    onChange({ ...project, messages: [...project.messages, ...messages] });
  }, [project, onChange]);
  
  /**
   * Clear all messages
   */
  const clearMessages = useCallback(() => {
    onChange({ ...project, messages: [] });
  }, [project, onChange]);
  
  return {
    update,
    updateSettings,
    updateMsg,
    deleteMsg,
    addMsg,
    addMessages,
    clearMessages
  };
}
