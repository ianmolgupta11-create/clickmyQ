"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import styles from "./Preloader.module.css";

interface PreloaderProps {
  loading?: boolean;
}

export default function Preloader({ loading: externalLoading }: PreloaderProps) {
  const [internalLoading, setInternalLoading] = useState(true);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/patient/')) {
        setSkip(true);
        setInternalLoading(false);
      }
    }
  }, []);

  if (skip) return null;

  useEffect(() => {
    if (externalLoading !== undefined) return;

    const handleLoad = () => {
      setTimeout(() => setInternalLoading(false), 800);
    };

    if (document.readyState === "complete") {
      handleLoad();
    } else {
      window.addEventListener("load", handleLoad);
      return () => window.removeEventListener("load", handleLoad);
    }
  }, [externalLoading]);

  useEffect(() => {
    if (externalLoading !== undefined) return;
    const fallback = setTimeout(() => setInternalLoading(false), 3000);
    return () => clearTimeout(fallback);
  }, [externalLoading]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/patient/')) {
        setInternalLoading(false);
        setSkip(true);
      }
    }
  }, []);

  const isLoading = externalLoading !== undefined ? externalLoading : internalLoading;

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className={styles.preloader}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: "easeInOut" } }}
          style={{ display: isLoading ? 'flex' : 'none' }}
        >
          <div className={styles.content}>
            <motion.div
              className={styles.logoWrapper}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [0.8, 1.1, 1],
                opacity: 1,
              }}
              transition={{
                duration: 1,
                ease: "easeOut",
                repeat: Infinity,
                repeatType: "reverse",
              }}
            >
              <Image
                src="/logo/fevicon-icon.png"
                alt="clickmyQ+ Logo"
                width={100}
                height={100}
                className={styles.logo}
                priority
              />
            </motion.div>
            
            <motion.div 
              className={styles.loaderLine}
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />
            
            <p className={styles.loadingText}>clickmyQ+</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
