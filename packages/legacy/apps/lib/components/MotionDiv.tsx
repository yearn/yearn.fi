import { variants } from "@lib/utils/animations";
import { motion } from "framer-motion";
import type { ReactElement } from "react";

type TMotionDiv = {
  animate: "enter" | "exit";
  name: string;
  children: ReactElement;
};

export function MotionDiv({
  animate,
  name,
  children,
}: TMotionDiv): ReactElement {
  return (
    <motion.div
      key={name}
      initial={"initial"}
      animate={animate}
      variants={variants}
      className={"absolute cursor-pointer"}
    >
      {children}
    </motion.div>
  );
}
