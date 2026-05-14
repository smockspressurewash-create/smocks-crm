// GInput.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

export const GInput = ({ className = "", ...r }) => <input className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all duration-200 " + className} {...r} />;
const GDate = ({ className = "", ...r }) => <input type="date" className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500/60 transition-all duration-200 [color-scheme:dark] " + className} {...r} />;
const GSel = ({ className = "", children, ...r }) => <select className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500/60 transition-all duration-200 " + className} {...r}>{children}</select>;
