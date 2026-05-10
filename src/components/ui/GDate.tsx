import React from 'react';

export const GDate = ({ className = "", ...r }: any) => (
  <input 
    type="date" 
    className={"w-full bg-black/40 backdrop-blur-md border border-red-900/30 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-red-500/60 transition-all duration-200 [color-scheme:dark] " + className} 
    {...r} 
  />
);
