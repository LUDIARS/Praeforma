import React from 'react';

/** Marks the page while UI editing is open; scene-editor.css hides the Pf chrome only on phone widths. */
const EDITING_BODY_CLASS = 'pf-ui-editing';

/** PF-WEB-9: full-screen UI editing on phones, only between open and close. */
export function useMobileUiEditing(): { isEditing: boolean; open: () => void; close: () => void } {
  const [isEditing, setEditing] = React.useState(false);
  React.useEffect(() => {
    if (!isEditing) return;
    document.body.classList.add(EDITING_BODY_CLASS);
    return () => document.body.classList.remove(EDITING_BODY_CLASS);
  }, [isEditing]);
  const open = React.useCallback(() => setEditing(true), []);
  const close = React.useCallback(() => setEditing(false), []);
  return { isEditing, open, close };
}
