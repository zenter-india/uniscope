const t=Date.now();
await import('sharp');
console.error('sharp imported in', Date.now()-t, 'ms');
const t2=Date.now();
await import('@supabase/supabase-js');
console.error('supabase imported in', Date.now()-t2, 'ms');
