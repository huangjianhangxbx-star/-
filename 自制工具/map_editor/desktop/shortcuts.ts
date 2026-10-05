/** Desktop editor commands leave text editing and modal dialogs to the browser. */
export function editorCommand(
  event: KeyboardEvent,
): "undo" | "redo" | "save" | null {
  const target = event.target;
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    !(event.ctrlKey || event.metaKey) ||
    (target instanceof Element &&
      target.closest(
        "input,select,textarea,[contenteditable]:not([contenteditable='false']),dialog",
      ))
  )
    return null;
  const key = event.key.toLowerCase();
  if (key === "z") return event.shiftKey ? "redo" : "undo";
  if (key === "y") return "redo";
  if (key === "s") return "save";
  return null;
}
