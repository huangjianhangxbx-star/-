/** Small, consistent SVG silhouettes for modeling and drawing tools. */
const paths:Record<string,string>={
 volume:'<path d="m12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5 M12 12v10"/>',
 stack:'<path d="m12 2 7 4-7 4-7-4Z M5 6v6l7 4 7-4V6 M5 12l-3 2 10 6 10-6-3-2 M2 14v4l10 5 10-5v-4 M12 10v6"/>',
 creative:'<path d="m9 4 7 4v8l-7 4-7-4V8Z M2 8l7 4 7-4 M9 12v8 M19 2v8 M15 6h8"/>',
 brush:'<path d="m9 14 9-11c2-2 5 1 3 3L11 16Z M9 14c-4-1-6 2-5 4 0 2-2 3-2 3s8 2 9-5"/>',
 rectangle:'<rect x="3" y="4" width="18" height="16" rx="1" stroke-dasharray="3 2"/><path d="M2 2v5 M0 4h5 M19 18v5 M17 20h5"/>',
 fill:'<path d="m5 7 7-5 8 9-8 7L4 10Z M7 2l7 9 M4 10h15 M21 16s-3 3-3 5a3 3 0 0 0 6 0c0-2-3-5-3-5Z"/>',
 repaint:'<path d="M4 3h14v7H4Z M18 6h3v7h-9v3 M10 16h4v6h-4Z"/>',
 erase:'<path d="m3 14 11-11 8 8-10 10H9Z M7 10l8 8 M12 21h10"/>'
};
export function toolIcon(name:string){return '<svg class="tool-icon" viewBox="-1 0 26 25" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]??paths.brush)+'</svg>';}
