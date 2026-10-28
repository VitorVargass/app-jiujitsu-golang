import { ComponentRef, RefObject } from "react";
import { View } from "react-native";
export function useDialogFocus(
  _panel: RefObject<ComponentRef<typeof View> | null>,
  _visible: boolean,
  _pending: boolean,
  _onClose: () => void,
) {}
