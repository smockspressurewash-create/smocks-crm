import React, { useState, useEffect } from 'react';

export const PageFade = ({ children }: any) => {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 10); return () => clearTimeout(t); }, []);
  return (
    <div style={{ opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(10px)", transition: "opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      {children}
    </div>
  );
};
