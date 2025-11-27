import { CGameImport } from '../types.js';

export const Draw_Diagnostics = (cgi: CGameImport, width: number, height: number) => {
    // Stats are usually retrieved via cgi.CL_GetStats() or similar if exposed.
    // For now we don't have direct access to engine stats via CGameImport unless we add it.
    // Standard Q2 cgame doesn't usually draw engine profiler stats (engine does that).
    // So we can probably remove this or leave it empty.
};
