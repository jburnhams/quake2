/* The name a refdef entity's model goes by. ref_gl gives every inline brush model ("*3") a copy of
   the world's model_t, name included, so the harness asks which mod_inline slot it is. */
#include "../../.id-source/full/ref_gl/gl_local.h"

#define MAX_MOD_KNOWN 512  /* gl_model.c */
extern model_t mod_inline[MAX_MOD_KNOWN];

int harness_inline_model(const void *m) {
	const model_t *mod = m;
	if (mod >= mod_inline && mod < mod_inline + MAX_MOD_KNOWN) return (int)(mod - mod_inline);
	return -1;
}
