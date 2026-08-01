import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yryqxondvmvpaqwfxdst.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jI8qseseDPLPlMoTNIjGFg_G0MOTZCF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);