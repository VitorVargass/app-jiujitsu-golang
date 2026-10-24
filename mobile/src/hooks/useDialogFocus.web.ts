import { RefObject, useEffect, useRef } from "react";
import { View } from "react-native";
const dialogs: symbol[] = [];
const selector = "a[href],button,input,select,textarea,[tabindex]";
export function useDialogFocus(
  panel: RefObject<View | null>,
  visible: boolean,
  pending: boolean,
  onClose: () => void,
) {
  const current = useRef({ pending, onClose });
  useEffect(() => {
    current.current = { pending, onClose };
  }, [pending, onClose]);
  useEffect(() => {
    if (!visible) return;
    const token = Symbol("dialog");
    dialogs.push(token);
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const element = () => panel.current as unknown as HTMLElement | null;
    function focusable() {
      return Array.from(
        element()?.querySelectorAll<HTMLElement>(selector) ?? [],
      ).filter(
        (node) =>
          node.tabIndex >= 0 &&
          !node.hasAttribute("disabled") &&
          node.getAttribute("aria-disabled") !== "true" &&
          node.getClientRects().length > 0,
      );
    }
    const frame = requestAnimationFrame(() =>
      (focusable()[0] ?? element())?.focus(),
    );
    function keydown(event: KeyboardEvent) {
      if (dialogs[dialogs.length - 1] !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!current.current.pending) current.current.onClose();
      } else if (event.key === "Tab") {
        const nodes = focusable(),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (!first) {
          event.preventDefault();
          element()?.focus();
          return;
        }
        if (
          !element()?.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown, true);
    return () => {
      cancelAnimationFrame(frame);
      const wasTop = dialogs[dialogs.length - 1] === token;
      const index = dialogs.indexOf(token);
      if (index >= 0) dialogs.splice(index, 1);
      document.removeEventListener("keydown", keydown, true);
      if (wasTop && previous?.isConnected) previous.focus();
    };
  }, [visible, panel]);
}
