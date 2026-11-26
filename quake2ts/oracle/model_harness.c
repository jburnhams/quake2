/*
 * Model loader oracle: runs ref_gl's gl_model.c (Mod_LoadBrushModel, Mod_LoadAliasModel,
 * Mod_LoadSpriteModel, Mod_PointInLeaf, Mod_ClusterPVS) unchanged and prints what it loaded as
 * JSON, one line per command read from stdin:
 *
 *   bsp <file>        load a map as the world; prints planes, texinfo (with animation frame
 *                     counts), faces (with CalcSurfaceExtents' texturemins and extents),
 *                     leafs, nodes, submodels, marksurfaces and each cluster's PVS row
 *   leaf <x y z>      Mod_PointInLeaf on the last map: the leaf index
 *   md2 <file>        an alias model: header, skins, st, triangles, frames, glcmds
 *   sp2 <file>        a sprite: its frames
 *
 * A load that the C refuses (ri.Sys_Error) prints {"error": "..."}. Nothing calls OpenGL: the
 * lightmap and polygon builders it would call are stubs here.
 */
#include <setjmp.h>
#include <stdarg.h>
#include <stdlib.h>
#include "../../full/ref_gl/gl_local.h"

extern model_t mod_known[];
extern model_t *loadmodel;
extern int modfilelen;
void Mod_LoadBrushModel(model_t *mod, void *buffer);
void Mod_LoadAliasModel(model_t *mod, void *buffer);
void Mod_LoadSpriteModel(model_t *mod, void *buffer);
mleaf_t *Mod_PointInLeaf(vec3_t p, model_t *model);
byte *Mod_ClusterPVS(int cluster, model_t *model);

static jmp_buf bail;
static char bail_msg[1024];

static void ri_Sys_Error(int level, char *fmt, ...) {
  va_list ap;
  va_start(ap, fmt);
  vsnprintf(bail_msg, sizeof(bail_msg), fmt, ap);
  va_end(ap);
  longjmp(bail, 1);
}
static void ri_Con_Printf(int level, char *fmt, ...) { (void)level; (void)fmt; }

refimport_t ri = { .Sys_Error = ri_Sys_Error, .Con_Printf = ri_Con_Printf };

/* The renderer state gl_model.c touches. */
model_t *currentmodel;
model_t *r_worldmodel;
image_t *r_notexture;
int r_viewcluster, r_oldviewcluster;
void GL_BeginBuildingLightmaps(model_t *m) { (void)m; }
void GL_EndBuildingLightmaps(void) {}
void GL_CreateSurfaceLightmap(msurface_t *s) { (void)s; }
void GL_BuildPolygonFromSurface(msurface_t *s) { (void)s; }
void GL_SubdivideSurface(msurface_t *s) { (void)s; }
void GL_FreeUnusedImages(void) {}
void Com_Printf(char *fmt, ...) { (void)fmt; }
image_t *GL_FindImage(char *name, imagetype_t type) {
  image_t *im = calloc(1, sizeof(image_t));
  strncpy(im->name, name, sizeof(im->name) - 1);
  im->type = type;
  return im;
}

/* The hunk is plain memory here; nothing is freed before the process exits. */
void *Hunk_Begin(int maxsize) { (void)maxsize; return NULL; }
/* Mod_ForName sets extradata to the hunk's start, which is the loaders' first allocation. */
static void *first_alloc;
static int fresh_hunk;
void *Hunk_Alloc(int size) {
  void *p = calloc(1, size > 0 ? size : 1);
  if (fresh_hunk) { first_alloc = p; fresh_hunk = 0; }
  return p;
}
int Hunk_End(void) { return 0; }
void Hunk_Free(void *base) { (void)base; }

static void *read_file(const char *path, int *len) {
  FILE *f = fopen(path, "rb");
  if (!f) return NULL;
  fseek(f, 0, SEEK_END);
  *len = (int)ftell(f);
  fseek(f, 0, SEEK_SET);
  void *buf = malloc(*len + 1);
  if (fread(buf, 1, *len, f) != (size_t)*len) { fclose(f); free(buf); return NULL; }
  fclose(f);
  return buf;
}

static void json_str(const char *s, int max) {
  putchar('"');
  for (int i = 0; i < max && s[i]; i++) {
    unsigned char c = (unsigned char)s[i];
    if (c == '"' || c == '\\') printf("\\%c", c);
    else if (c < 0x20 || c >= 0x7f) printf("\\u%04x", c);
    else putchar(c);
  }
  putchar('"');
}

static void json_vec(const float *v, int n) {
  putchar('[');
  for (int i = 0; i < n; i++) printf(i ? ",%.9g" : "%.9g", v[i]);
  putchar(']');
}

static void print_bsp(model_t *m) {
  int i;
  printf("{\"planes\":[");
  for (i = 0; i < m->numplanes; i++) {
    cplane_t *p = &m->planes[i];
    printf("%s[%.9g,%.9g,%.9g,%.9g,%d,%d]", i ? "," : "", p->normal[0], p->normal[1], p->normal[2], p->dist, p->type, p->signbits);
  }
  printf("],\"texinfo\":[");
  for (i = 0; i < m->numtexinfo; i++) {
    mtexinfo_t *t = &m->texinfo[i];
    printf("%s[", i ? "," : "");
    json_vec(t->vecs[0], 4);
    putchar(',');
    json_vec(t->vecs[1], 4);
    printf(",%d,%d,%d,", t->flags, t->next ? (int)(t->next - m->texinfo) : -1, t->numframes);
    json_str(t->image->name, MAX_QPATH);
    putchar(']');
  }
  printf("],\"faces\":[");
  for (i = 0; i < m->numsurfaces; i++) {
    msurface_t *s = &m->surfaces[i];
    printf("%s[%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d]", i ? "," : "", (int)(s->plane - m->planes), s->flags, s->firstedge,
           s->numedges, (int)(s->texinfo - m->texinfo), s->texturemins[0], s->texturemins[1], s->extents[0], s->extents[1],
           s->styles[0], s->styles[1], s->styles[2], s->styles[3], s->samples ? (int)(s->samples - m->lightdata) : -1);
  }
  printf("],\"leafs\":[");
  for (i = 0; i < m->numleafs; i++) {
    mleaf_t *l = &m->leafs[i];
    printf("%s[%d,%d,%d,", i ? "," : "", l->contents, l->cluster, l->area);
    json_vec(l->minmaxs, 6);
    printf(",%d,%d,%d]", (int)(l->firstmarksurface - m->marksurfaces), l->nummarksurfaces,
           l->parent ? (int)(l->parent - m->nodes) : -1);
  }
  printf("],\"nodes\":[");
  for (i = 0; i < m->numnodes; i++) {
    mnode_t *n = &m->nodes[i];
    int c[2];
    for (int j = 0; j < 2; j++) {
      mnode_t *ch = n->children[j];
      c[j] = ch->contents == -1 ? (int)(ch - m->nodes) : -1 - (int)((mleaf_t *)ch - m->leafs);
    }
    printf("%s[%d,%d,%d,", i ? "," : "", (int)(n->plane - m->planes), c[0], c[1]);
    json_vec(n->minmaxs, 6);
    printf(",%d,%d,%d]", n->firstsurface, n->numsurfaces, n->parent ? (int)(n->parent - m->nodes) : -1);
  }
  printf("],\"submodels\":[");
  for (i = 0; i < m->numsubmodels; i++) {
    mmodel_t *b = &m->submodels[i];
    printf("%s[", i ? "," : "");
    json_vec(b->mins, 3);
    putchar(',');
    json_vec(b->maxs, 3);
    putchar(',');
    json_vec(b->origin, 3);
    printf(",%.9g,%d,%d,%d]", b->radius, b->headnode, b->firstface, b->numfaces);
  }
  printf("],\"marksurfaces\":[");
  for (i = 0; i < m->nummarksurfaces; i++) printf(i ? ",%d" : "%d", (int)(m->marksurfaces[i] - m->surfaces));
  printf("],\"edges\":%d,\"vertexes\":%d,\"surfedges\":%d", m->numedges, m->numvertexes, m->numsurfedges);
  int clusters = m->vis ? m->vis->numclusters : 0;
  int row = (clusters + 7) >> 3;
  printf(",\"numclusters\":%d,\"pvs\":[", clusters);
  for (i = 0; i < clusters; i++) {
    byte *pvs = Mod_ClusterPVS(i, m);
    printf("%s\"", i ? "," : "");
    for (int j = 0; j < row; j++) printf("%02x", pvs[j]);
    putchar('"');
  }
  printf("]}\n");
}

static void print_md2(model_t *mod) {
  dmdl_t *h = (dmdl_t *)mod->extradata;
  int i, j;
  printf("{\"header\":[%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d]", h->skinwidth, h->skinheight, h->framesize, h->num_skins,
         h->num_xyz, h->num_st, h->num_tris, h->num_glcmds, h->num_frames, h->ofs_end, h->version);
  printf(",\"skins\":[");
  for (i = 0; i < h->num_skins; i++) {
    if (i) putchar(',');
    json_str(mod->skins[i]->name, MAX_QPATH);
  }
  dstvert_t *st = (dstvert_t *)((byte *)h + h->ofs_st);
  printf("],\"st\":[");
  for (i = 0; i < h->num_st; i++) printf("%s%d,%d", i ? "," : "", st[i].s, st[i].t);
  dtriangle_t *tri = (dtriangle_t *)((byte *)h + h->ofs_tris);
  printf("],\"tris\":[");
  for (i = 0; i < h->num_tris; i++)
    printf("%s%d,%d,%d,%d,%d,%d", i ? "," : "", tri[i].index_xyz[0], tri[i].index_xyz[1], tri[i].index_xyz[2],
           tri[i].index_st[0], tri[i].index_st[1], tri[i].index_st[2]);
  printf("],\"frames\":[");
  for (i = 0; i < h->num_frames; i++) {
    daliasframe_t *f = (daliasframe_t *)((byte *)h + h->ofs_frames + i * h->framesize);
    printf("%s{\"name\":", i ? "," : "");
    json_str(f->name, 16);
    printf(",\"scale\":");
    json_vec(f->scale, 3);
    printf(",\"translate\":");
    json_vec(f->translate, 3);
    printf(",\"verts\":\"");
    for (j = 0; j < h->num_xyz; j++)
      printf("%02x%02x%02x%02x", f->verts[j].v[0], f->verts[j].v[1], f->verts[j].v[2], f->verts[j].lightnormalindex);
    printf("\"}");
  }
  int *cmd = (int *)((byte *)h + h->ofs_glcmds);
  printf("],\"glcmds\":[");
  for (i = 0; i < h->num_glcmds; i++) printf(i ? ",%d" : "%d", cmd[i]);
  printf("]}\n");
}

static void print_sp2(model_t *mod) {
  dsprite_t *s = (dsprite_t *)mod->extradata;
  printf("{\"frames\":[");
  for (int i = 0; i < s->numframes; i++) {
    printf("%s[%d,%d,%d,%d,", i ? "," : "", s->frames[i].width, s->frames[i].height, s->frames[i].origin_x, s->frames[i].origin_y);
    json_str(s->frames[i].name, MAX_SKINNAME);
    putchar(']');
  }
  printf("]}\n");
}

int main(void) {
  char line[4096];
  Swap_Init();
  printf("{\"ready\":true}\n");
  fflush(stdout);
  model_t *world = &mod_known[0];
  while (fgets(line, sizeof(line), stdin)) {
    char op[16], path[4000];
    float p[3];
    if (sscanf(line, "%15s", op) != 1) continue;
    if (!strcmp(op, "leaf") && sscanf(line, "%*s %f %f %f", &p[0], &p[1], &p[2]) == 3) {
      if (setjmp(bail)) { printf("{\"error\":\"%s\"}\n", "no world"); continue; }
      printf("{\"leaf\":%d}\n", (int)(Mod_PointInLeaf(p, world) - world->leafs));
      continue;
    }
    if (sscanf(line, "%*s %3999s", path) != 1) { printf("{\"error\":\"bad command\"}\n"); continue; }
    int len;
    void *buf = read_file(path, &len);
    if (!buf) { printf("{\"error\":\"cannot read\"}\n"); continue; }
    modfilelen = len;
    model_t *mod = !strcmp(op, "bsp") ? world : &mod_known[1];
    memset(mod, 0, sizeof(*mod));
    strncpy(mod->name, path, sizeof(mod->name) - 1);
    loadmodel = mod;
    fresh_hunk = 1;
    if (setjmp(bail)) {
      putchar('{');
      printf("\"error\":");
      json_str(bail_msg, sizeof(bail_msg));
      printf("}\n");
      fflush(stdout);
      continue;
    }
    if (!strcmp(op, "bsp")) {
      Mod_LoadBrushModel(mod, buf);
      r_worldmodel = mod;
      print_bsp(mod);
    } else if (!strcmp(op, "md2")) {
      Mod_LoadAliasModel(mod, buf);
      mod->extradata = first_alloc;
      print_md2(mod);
    } else if (!strcmp(op, "sp2")) {
      Mod_LoadSpriteModel(mod, buf);
      mod->extradata = first_alloc;
      print_sp2(mod);
    } else {
      printf("{\"error\":\"bad command\"}\n");
    }
    fflush(stdout);
  }
  return 0;
}
