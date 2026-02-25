import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = 'https://sxxntcaobektiltyppwz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4eG50Y2FvYmVrdGlsdHlwcHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMTU4NzIsImV4cCI6MjA4NjY5MTg3Mn0.Fi3SMNxUQeBm0fdMEJzNY_orgag5siD0IjDZsbJ2upg'

export const supabase = createClient(supabaseUrl, supabaseKey)

// 🔥 NUEVA LÍNEA - HACE SUPABASE GLOBAL
window.supabase = supabase

console.log('✅ Supabase conectado:', supabaseUrl)