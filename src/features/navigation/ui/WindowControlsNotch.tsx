import { motion } from "framer-motion";
import { Notch, type NotchProps } from "@/shared/ui";
import WindowControls, {
  WINDOW_CONTROLS_LAYOUT_ID,
  WINDOW_CONTROLS_MORPH,
} from "./WindowControls";

interface WindowControlsNotchProps {
  tone?: NotchProps["tone"];
  blur?: boolean;
}

export default function WindowControlsNotch({
  tone,
  blur,
}: WindowControlsNotchProps) {
  return (
    <motion.div
      layoutId={WINDOW_CONTROLS_LAYOUT_ID}
      transition={WINDOW_CONTROLS_MORPH}
      data-no-window-drag
      data-no-tooltip="true"
    >
      <Notch align="end" tone={tone} blur={blur}>
        <WindowControls bare />
      </Notch>
    </motion.div>
  );
}
