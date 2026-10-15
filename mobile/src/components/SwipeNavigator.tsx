import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Keyboard,
  PanResponder,
  PanResponderGestureState,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { colors } from "../theme";

export type SwipeDirection = "left" | "right";
export type SwipePages = { right: React.ReactNode; left: React.ReactNode };
const COMMIT_RATIO = 0.55;

function startedOnInput(event: GestureResponderEvent) {
  if (Platform.OS !== "web") return Keyboard.isVisible();
  const target = event.nativeEvent.target as unknown;
  return (
    typeof Element !== "undefined" &&
    target instanceof Element &&
    !!target.closest("input, textarea, [contenteditable=true]")
  );
}

// Pointer state lives in handlers. Moving the finger never re-renders the pages.
function createResponder(
  offset: Animated.Value,
  width: number,
  onSwipe?: (direction: SwipeDirection) => void,
) {
  let axis: "horizontal" | "vertical" | undefined;
  let started = false;
  let disposed = false;
  let blocked = false;
  let dragging = false;
  let settling = false;
  let originX = 0;
  let originY = 0;
  let dragX = 0;
  let dragY = 0;

  function move(event: GestureResponderEvent) {
    if (disposed) return;
    dragX = Math.max(
      -width,
      Math.min(width, event.nativeEvent.pageX - originX),
    );
    dragY = event.nativeEvent.pageY - originY;
    offset.setValue(dragX);
  }
  function settle(commit: boolean) {
    if (settling || disposed) return;
    dragging = false;
    started = false;
    settling = true;
    const direction: SwipeDirection = dragX > 0 ? "right" : "left";
    const target = commit ? (dragX > 0 ? width : -width) : 0;
    const remaining = Math.abs(target - dragX) / width;
    Animated.timing(offset, {
      toValue: target,
      duration: Math.round(110 + Math.min(1, remaining) * 90),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start(({ finished }) => {
      if (disposed) return;
      settling = false;
      if (finished && commit) onSwipe?.(direction);
      else offset.setValue(0);
    });
  }
  function capture(
    _event: GestureResponderEvent,
    gesture: PanResponderGestureState,
  ) {
    if (
      disposed ||
      !onSwipe ||
      !started ||
      blocked ||
      dragging ||
      settling ||
      gesture.numberActiveTouches !== 1
    )
      return false;
    const horizontal = Math.abs(gesture.dx);
    const vertical = Math.abs(gesture.dy);
    if (!axis && Math.max(horizontal, vertical) > 12) {
      axis = horizontal > vertical * 1.8 ? "horizontal" : "vertical";
    }
    return axis === "horizontal";
  }
  const responder = PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => {
      if (disposed) return false;
      if (dragging || settling) {
        if (settling || event.nativeEvent.touches.length > 1) blocked = true;
        return false;
      }
      started = true;
      blocked = startedOnInput(event) || event.nativeEvent.touches.length !== 1;
      axis = undefined;
      originX = event.nativeEvent.pageX;
      originY = event.nativeEvent.pageY;
      dragX = 0;
      dragY = 0;
      return false;
    },
    onMoveShouldSetPanResponderCapture: capture,
    onPanResponderGrant: (event) => {
      if (disposed) return;
      dragging = true;
      offset.stopAnimation();
      move(event);
    },
    onPanResponderStart: (_event, gesture) => {
      if (gesture.numberActiveTouches > 1) blocked = true;
    },
    onPanResponderMove: (event, gesture) => {
      if (gesture.numberActiveTouches !== 1) blocked = true;
      if (!blocked) move(event);
    },
    onPanResponderRelease: () => {
      settle(
        !blocked &&
          Math.abs(dragX) >= width * COMMIT_RATIO &&
          Math.abs(dragX) > Math.abs(dragY) * 1.8,
      );
    },
    onPanResponderTerminate: () => settle(false),
    onPanResponderTerminationRequest: () => !dragging && !settling,
  });
  return {
    panHandlers: responder.panHandlers,
    activate() {
      disposed = false;
      started = false;
      blocked = false;
      dragging = false;
      settling = false;
      axis = undefined;
    },
    dispose() {
      disposed = true;
      started = false;
      offset.stopAnimation();
      offset.setValue(0);
    },
  };
}

/** Three real pages form a circular strip. Rightward dragging brings in the next from the left. */
export function SwipeNavigator({
  children,
  onSwipe,
  pages,
}: {
  children: React.ReactNode;
  onSwipe?: (direction: SwipeDirection) => void;
  pages?: SwipePages;
}) {
  const window = useWindowDimensions();
  const [width, setWidth] = useState(window.width);
  const [offset] = useState(() => new Animated.Value(0));
  const responder = useMemo(
    () => createResponder(offset, width, onSwipe),
    [offset, width, onSwipe],
  );
  useEffect(() => {
    responder.activate();
    return () => responder.dispose();
  }, [responder]);
  if (!pages) return <View style={styles.frame}>{children}</View>;
  return (
    <View
      testID="section-pager"
      onLayout={(event) => {
        const measured = event.nativeEvent.layout.width;
        if (measured > 0) setWidth(measured);
      }}
      style={[
        styles.frame,
        Platform.OS === "web" && {
          touchAction: "pan-y",
          overscrollBehaviorX: "none",
        },
      ]}
      {...responder.panHandlers}
    >
      <Animated.View
        testID="section-strip"
        style={[styles.strip, { transform: [{ translateX: offset }] }]}
      >
        <View
          testID="section-preview-right"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={[styles.panel, { width, left: -width }]}
        >
          {pages.right}
        </View>
        <View
          testID="section-current"
          style={[styles.panel, { width, left: 0 }]}
        >
          {children}
        </View>
        <View
          testID="section-preview-left"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
          style={[styles.panel, { width, left: width }]}
        >
          {pages.left}
        </View>
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  frame: { flex: 1, overflow: "hidden", backgroundColor: colors.background },
  strip: { flex: 1 },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
});
