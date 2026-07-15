"use client";

import { motion, type Transition } from "framer-motion";

export function Reveal({
  children,
  className,
  delay = 0,
  y = 24,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const transition: Transition = {
    duration: 0.6,
    delay,
    ease: [0.16, 1, 0.3, 1],
  };

  return (
    <motion.div
      data-motion-reveal
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
