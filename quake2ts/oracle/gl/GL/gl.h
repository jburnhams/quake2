/* Just enough of OpenGL's types for ref_gl's headers to compile; the oracle calls no GL. */
#ifndef ORACLE_FAKE_GL_H
#define ORACLE_FAKE_GL_H
#define APIENTRY
typedef unsigned int GLenum;
typedef unsigned char GLboolean;
typedef unsigned int GLbitfield;
typedef signed char GLbyte;
typedef short GLshort;
typedef int GLint;
typedef int GLsizei;
typedef unsigned char GLubyte;
typedef unsigned short GLushort;
typedef unsigned int GLuint;
typedef float GLfloat;
typedef float GLclampf;
typedef double GLdouble;
typedef double GLclampd;
typedef void GLvoid;
#endif
